using System;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace WorkView.Agent
{
    /// <summary>
    /// Zjistí lokální (privátní) IPv4 adresu FYZICKÉHO síťového adaptéru.
    /// Virtuální a VPN adaptéry se vynechávají – díky tomu se Home Office přes
    /// VPN netváří jako firemní pobočka (PC má doma vlastní podsíť).
    /// Nezjišťuje veřejnou IP ani polohu – jen údaj o síti zařízení.
    /// </summary>
    internal static class NetworkInfo
    {
        private static readonly string[] Virtual = {
            "virtual", "vpn", "tap", "tun", "hyper-v", "vethernet", "vmware",
            "virtualbox", "loopback", "pseudo", "wan miniport", "bluetooth", "docker",
        };

        public static string LocalIPv4()
        {
            try
            {
                string fallback = null;
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up) continue;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback ||
                        ni.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;

                    string id = ((ni.Name ?? "") + " " + (ni.Description ?? "")).ToLowerInvariant();
                    bool isVirtual = false;
                    foreach (string v in Virtual) if (id.IndexOf(v, StringComparison.Ordinal) >= 0) { isVirtual = true; break; }
                    if (isVirtual) continue;

                    bool physical = ni.NetworkInterfaceType == NetworkInterfaceType.Ethernet ||
                                    ni.NetworkInterfaceType == NetworkInterfaceType.GigabitEthernet ||
                                    ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211;

                    foreach (UnicastIPAddressInformation ua in ni.GetIPProperties().UnicastAddresses)
                    {
                        if (ua.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                        string ip = ua.Address.ToString();
                        if (ip.StartsWith("169.254.", StringComparison.Ordinal)) continue; // APIPA = bez sítě
                        if (physical) return ip;          // fyzický adaptér má přednost
                        if (fallback == null) fallback = ip; // jinak zapamatuj jako záložní
                    }
                }
                return fallback;
            }
            catch
            {
                return null;
            }
        }
    }
}
