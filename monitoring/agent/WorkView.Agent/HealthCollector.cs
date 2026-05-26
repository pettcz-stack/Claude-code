using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Management;
using System.Text;

namespace WorkView.Agent
{
    /// <summary>
    /// Sebere HW snapshot pro IT dashboard: OS, BIOS, CPU, RAM, baterie, disky, antivirus.
    /// Volá se 1× za hodinu na pozadí. Všechny dotazy mají dvojitý ochranný try/catch,
    /// aby selhání jednoho WMI tříd nezhodilo celý snapshot. Žádný dotaz nečte obsah.
    /// </summary>
    internal static class HealthCollector
    {
        /// <summary>
        /// Sebere snapshot a sestaví JSON přesně podle schématu serverového ingest endpointu
        /// (POST /api/v1/ingest/health). Server uloží do tabulky DeviceHealth a sám určí
        /// stav OK/WARN/CRITICAL podle hodnot.
        /// </summary>
        public static string BuildJson()
        {
            // Nejprve si vše posbíráme do lokálních proměnných, JSON sestavíme až nakonec.
            string osName = null, osVersion = null;
            int? uptimeSec = null;
            string manufacturer = null, model = null, serial = null;
            string biosVersion = null;
            DateTime? biosDate = null;
            string cpuModel = null;
            int? cpuLoadPct = null;
            int? ramTotalMB = null, ramUsedPct = null;
            bool batteryPresent = false;
            int? batteryChargePct = null;
            int? batteryHealthPct = null;
            int? batteryCycles = null;
            bool? onAcPower = null;
            List<DiskInfo> disks = new List<DiskInfo>();
            bool? antivirusEnabled = null, antivirusUpdated = null;
            int? pendingUpdates = null;
            bool? rebootPending = null;

            // --- OS, uptime ---
            SafeWmi("root\\CIMV2", "SELECT Caption, Version, BuildNumber, LastBootUpTime FROM Win32_OperatingSystem", mo =>
            {
                osName = mo["Caption"] as string;
                string ver = mo["Version"] as string;
                string build = mo["BuildNumber"] as string;
                osVersion = ver != null ? ver + (build != null ? " (build " + build + ")" : "") : null;
                string boot = mo["LastBootUpTime"] as string;
                if (!string.IsNullOrEmpty(boot))
                {
                    DateTime bootTime = ManagementDateTimeConverter.ToDateTime(boot);
                    uptimeSec = (int)Math.Max(0, (DateTime.Now - bootTime).TotalSeconds);
                }
                // Vlastní detekce Win11 (registry vrátí "Windows 10..." i pro Win11)
                if (osName != null && build != null && int.TryParse(build, out int bn) && bn >= 22000)
                {
                    osName = System.Text.RegularExpressions.Regex.Replace(osName, "Windows 10", "Windows 11", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                }
            });

            // --- RAM celkem + využití ---
            SafeWmi("root\\CIMV2", "SELECT TotalVisibleMemorySize, FreePhysicalMemory FROM Win32_OperatingSystem", mo =>
            {
                ulong totalKb = (ulong)mo["TotalVisibleMemorySize"];
                ulong freeKb = (ulong)mo["FreePhysicalMemory"];
                ramTotalMB = (int)(totalKb / 1024);
                if (totalKb > 0) ramUsedPct = (int)Math.Round((totalKb - freeKb) * 100.0 / totalKb);
            });

            // --- ComputerSystem (výrobce, model) ---
            SafeWmi("root\\CIMV2", "SELECT Manufacturer, Model FROM Win32_ComputerSystem", mo =>
            {
                manufacturer = mo["Manufacturer"] as string;
                model = mo["Model"] as string;
            });

            // --- BIOS ---
            SafeWmi("root\\CIMV2", "SELECT SMBIOSBIOSVersion, ReleaseDate, SerialNumber FROM Win32_BIOS", mo =>
            {
                biosVersion = mo["SMBIOSBIOSVersion"] as string;
                serial = mo["SerialNumber"] as string;
                string rel = mo["ReleaseDate"] as string;
                if (!string.IsNullOrEmpty(rel))
                {
                    try { biosDate = ManagementDateTimeConverter.ToDateTime(rel); } catch { /* ignore */ }
                }
            });

            // --- CPU model + průměrné vytížení (z PerfFormattedData) ---
            SafeWmi("root\\CIMV2", "SELECT Name FROM Win32_Processor", mo =>
            {
                if (cpuModel == null) cpuModel = (mo["Name"] as string)?.Trim();
            });
            SafeWmi("root\\CIMV2", "SELECT PercentProcessorTime FROM Win32_PerfFormattedData_PerfOS_Processor WHERE Name='_Total'", mo =>
            {
                ulong v = (ulong)mo["PercentProcessorTime"];
                cpuLoadPct = (int)Math.Min(100, v);
            });

            // --- Baterie (jen u notebooků) ---
            SafeWmi("root\\CIMV2", "SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery", mo =>
            {
                batteryPresent = true;
                try { batteryChargePct = Convert.ToInt32(mo["EstimatedChargeRemaining"]); } catch { /* ignore */ }
                try
                {
                    // BatteryStatus: 1=discharging, 2=AC, 3=fully charged, ...
                    ushort st = Convert.ToUInt16(mo["BatteryStatus"]);
                    onAcPower = st == 2 || st == 3 || st == 6 || st == 7 || st == 8 || st == 9;
                }
                catch { /* ignore */ }
            });
            // Zdraví baterie přes WMI root\WMI BatteryStaticData + BatteryFullChargedCapacity
            if (batteryPresent)
            {
                int designed = 0, fullCharged = 0, cycles = 0;
                SafeWmi("root\\WMI", "SELECT DesignedCapacity FROM BatteryStaticData", mo =>
                {
                    designed = Math.Max(designed, Convert.ToInt32(mo["DesignedCapacity"]));
                });
                SafeWmi("root\\WMI", "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity", mo =>
                {
                    fullCharged = Math.Max(fullCharged, Convert.ToInt32(mo["FullChargedCapacity"]));
                });
                SafeWmi("root\\WMI", "SELECT CycleCount FROM BatteryCycleCount", mo =>
                {
                    cycles = Math.Max(cycles, Convert.ToInt32(mo["CycleCount"]));
                });
                if (designed > 0 && fullCharged > 0) batteryHealthPct = (int)Math.Round(fullCharged * 100.0 / designed);
                if (cycles > 0) batteryCycles = cycles;
            }

            // --- Disky: místo + SMART status ---
            Dictionary<string, DiskInfo> diskMap = new Dictionary<string, DiskInfo>(StringComparer.OrdinalIgnoreCase);
            SafeWmi("root\\CIMV2", "SELECT DeviceID, Size, FreeSpace, DriveType FROM Win32_LogicalDisk WHERE DriveType=3", mo =>
            {
                string id = mo["DeviceID"] as string; // např. "C:"
                if (string.IsNullOrEmpty(id)) return;
                ulong size = 0, free = 0;
                try { size = (ulong)mo["Size"]; } catch { /* ignore */ }
                try { free = (ulong)mo["FreeSpace"]; } catch { /* ignore */ }
                DiskInfo d = new DiskInfo { Name = id, TotalGB = size > 0 ? (int)(size / 1073741824UL) : (int?)null, FreeGB = free > 0 ? (int)(free / 1073741824UL) : (int?)null };
                diskMap[id] = d;
            });
            // SMART status z root\WMI MSStorageDriver_FailurePredictStatus + Win32_DiskDrive pro mapování
            SafeWmi("root\\WMI", "SELECT InstanceName, PredictFailure FROM MSStorageDriver_FailurePredictStatus", mo =>
            {
                bool fail = false;
                try { fail = Convert.ToBoolean(mo["PredictFailure"]); } catch { /* ignore */ }
                // Použijeme pro PRVNÍ disk v mapě (jednodušší než spárovat instanceName s LogicalDisk).
                foreach (KeyValuePair<string, DiskInfo> kv in diskMap)
                {
                    if (kv.Value.SmartStatus == null) { kv.Value.SmartStatus = fail ? "CRITICAL" : "OK"; break; }
                }
            });
            foreach (DiskInfo d in diskMap.Values)
            {
                if (d.SmartStatus == null) d.SmartStatus = "UNKNOWN";
                disks.Add(d);
            }

            // --- Antivirus (jen na klientském Windows, ne na Serveru) ---
            SafeWmi("root\\SecurityCenter2", "SELECT displayName, productState FROM AntiVirusProduct", mo =>
            {
                try
                {
                    uint state = Convert.ToUInt32(mo["productState"]);
                    // Bity dle Microsoft Defender: 0x1000 enabled, 0x10 disabled, definice v 0x10..0x30 = staré
                    bool enabled = (state & 0x1000) != 0;
                    bool oldDefs = (state & 0x10) != 0;
                    if (antivirusEnabled == null || enabled) antivirusEnabled = enabled;
                    if (antivirusUpdated == null) antivirusUpdated = !oldDefs;
                }
                catch { /* ignore */ }
            });

            // --- Čekající restart (registry check, levné) ---
            try
            {
                using (Microsoft.Win32.RegistryKey k = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending"))
                { if (k != null) rebootPending = true; }
                if (rebootPending != true)
                {
                    using (Microsoft.Win32.RegistryKey k = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired"))
                    { if (k != null) rebootPending = true; }
                }
                if (rebootPending == null) rebootPending = false;
            }
            catch { /* ignore */ }

            // pendingUpdates: WUApi je drahé, nechame TODO – server v UI ukáže "—"
            pendingUpdates = null;

            // --- JSON ---
            StringBuilder sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"machineId\":").Append(Json.Str(MachineIdentity.MachineId()));
            sb.Append(",\"reportedAt\":").Append(Json.Str(DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture)));
            JsonStrField(sb, "osName", osName);
            JsonStrField(sb, "osVersion", osVersion);
            JsonNumField(sb, "uptimeSec", uptimeSec);
            JsonStrField(sb, "manufacturer", manufacturer);
            JsonStrField(sb, "model", model);
            JsonStrField(sb, "serial", serial);
            JsonStrField(sb, "biosVersion", biosVersion);
            if (biosDate.HasValue) sb.Append(",\"biosDate\":").Append(Json.Str(biosDate.Value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ", CultureInfo.InvariantCulture)));
            JsonStrField(sb, "cpuModel", cpuModel);
            JsonNumField(sb, "cpuLoadPct", cpuLoadPct);
            JsonNumField(sb, "ramTotalMB", ramTotalMB);
            JsonNumField(sb, "ramUsedPct", ramUsedPct);
            sb.Append(",\"batteryPresent\":").Append(Json.Bool(batteryPresent));
            JsonNumField(sb, "batteryChargePct", batteryChargePct);
            JsonNumField(sb, "batteryHealthPct", batteryHealthPct);
            JsonNumField(sb, "batteryCycles", batteryCycles);
            if (onAcPower.HasValue) sb.Append(",\"onAcPower\":").Append(Json.Bool(onAcPower.Value));
            if (disks.Count > 0)
            {
                sb.Append(",\"disks\":[");
                for (int i = 0; i < disks.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    DiskInfo d = disks[i];
                    sb.Append('{');
                    sb.Append("\"name\":").Append(Json.Str(d.Name));
                    if (d.TotalGB.HasValue) sb.Append(",\"totalGB\":").Append(d.TotalGB.Value);
                    if (d.FreeGB.HasValue) sb.Append(",\"freeGB\":").Append(d.FreeGB.Value);
                    if (d.SmartStatus != null) sb.Append(",\"smartStatus\":").Append(Json.Str(d.SmartStatus));
                    sb.Append('}');
                }
                sb.Append(']');
            }
            if (antivirusEnabled.HasValue) sb.Append(",\"antivirusEnabled\":").Append(Json.Bool(antivirusEnabled.Value));
            if (antivirusUpdated.HasValue) sb.Append(",\"antivirusUpdated\":").Append(Json.Bool(antivirusUpdated.Value));
            JsonNumField(sb, "pendingUpdates", pendingUpdates);
            if (rebootPending.HasValue) sb.Append(",\"rebootPending\":").Append(Json.Bool(rebootPending.Value));
            sb.Append('}');
            return sb.ToString();
        }

        private static void SafeWmi(string scope, string query, Action<ManagementBaseObject> handler)
        {
            try
            {
                using (ManagementObjectSearcher s = new ManagementObjectSearcher(scope, query))
                using (ManagementObjectCollection rs = s.Get())
                {
                    foreach (ManagementBaseObject mo in rs)
                    {
                        try { handler(mo); }
                        catch { /* logujeme tiše per-položku, nezhodit collector */ }
                        finally { mo.Dispose(); }
                    }
                }
            }
            catch { /* WMI nemusí být dostupné (Server Core, restrikce) – snapshot prostě nebude úplný */ }
        }

        private static void JsonStrField(StringBuilder sb, string key, string val)
        {
            if (val != null) sb.Append(',').Append('"').Append(key).Append("\":").Append(Json.Str(val));
        }
        private static void JsonNumField(StringBuilder sb, string key, int? val)
        {
            if (val.HasValue) sb.Append(',').Append('"').Append(key).Append("\":").Append(val.Value);
        }

        private sealed class DiskInfo
        {
            public string Name;
            public int? TotalGB;
            public int? FreeGB;
            public string SmartStatus;
        }
    }
}
