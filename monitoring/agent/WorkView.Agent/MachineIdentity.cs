using System;
using System.Security.Principal;
using Microsoft.Win32;

namespace WorkView.Agent
{
    /// <summary>Identita zařízení a aktuálního uživatele (bez osobních dat nad rámec nutného).</summary>
    internal static class MachineIdentity
    {
        public static string MachineId()
        {
            try
            {
                using (RegistryKey baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                using (RegistryKey key = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography"))
                {
                    object guid = key?.GetValue("MachineGuid");
                    if (guid != null) return guid.ToString();
                }
            }
            catch { }
            return Environment.MachineName;
        }

        public static string Hostname()
        {
            return Environment.MachineName;
        }

        public static string OsName()
        {
            try
            {
                using (RegistryKey baseKey = RegistryKey.OpenBaseKey(RegistryHive.LocalMachine, RegistryView.Registry64))
                using (RegistryKey key = baseKey.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion"))
                {
                    if (key == null) return Environment.OSVersion.ToString();
                    string product = key.GetValue("ProductName") as string;
                    string display = key.GetValue("DisplayVersion") as string; // např. "23H2", "22H2"
                    string buildStr = key.GetValue("CurrentBuildNumber") as string;
                    int build;
                    int.TryParse(buildStr, out build);
                    // Microsoft v registru NEAKTUALIZOVAL ProductName na "Windows 11" – stále vrací
                    // "Windows 10 ...". Rozlišení podle build čísla: Win11 = build ≥ 22000.
                    if (!string.IsNullOrEmpty(product) && build >= 22000 && product.IndexOf("Windows 10", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        product = System.Text.RegularExpressions.Regex.Replace(product, "Windows 10", "Windows 11", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    }
                    if (!string.IsNullOrEmpty(product))
                    {
                        return string.IsNullOrEmpty(display) ? product : product + " (" + display + ")";
                    }
                }
            }
            catch { }
            return Environment.OSVersion.ToString();
        }

        public static string UserSid()
        {
            try
            {
                WindowsIdentity id = WindowsIdentity.GetCurrent();
                if (id?.User != null) return id.User.Value;
            }
            catch { }
            return Environment.UserName; // krajní fallback
        }

        public static string UserDisplayName()
        {
            return Environment.UserName;
        }
    }
}
