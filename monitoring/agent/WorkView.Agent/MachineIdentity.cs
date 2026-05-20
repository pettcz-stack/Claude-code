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
                    object name = key?.GetValue("ProductName");
                    if (name != null) return name.ToString();
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
