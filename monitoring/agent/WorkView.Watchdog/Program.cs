using System.ServiceProcess;

namespace WorkView.Watchdog
{
    internal static class Program
    {
        private static void Main()
        {
            ServiceBase.Run(new ServiceBase[] { new WatchdogService() });
        }
    }
}
