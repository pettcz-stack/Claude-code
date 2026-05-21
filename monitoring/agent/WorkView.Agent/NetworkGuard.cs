using System;
using System.Net;

namespace WorkView.Agent
{
    /// <summary>
    /// Ověří, zda je PC připojený k firemní síti. Princip: pokus o DNS překlad
    /// interního jména (CompanyProbeHost). Vně firmy se interní-only jméno nepřeloží,
    /// uvnitř (LAN) i přes VPN s firemním DNS se přeloží. Žádný odeslaný obsah.
    /// </summary>
    internal static class NetworkGuard
    {
        public static bool OnCompanyNetwork(string probeHost)
        {
            if (string.IsNullOrWhiteSpace(probeHost)) return true; // bez sondy nebráníme odeslání
            try
            {
                IPHostEntry entry = Dns.GetHostEntry(probeHost);
                return entry != null && entry.AddressList != null && entry.AddressList.Length > 0;
            }
            catch
            {
                return false; // nepřeloženo / nedostupné = mimo firemní síť
            }
        }
    }
}
