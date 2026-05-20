using System;

namespace WorkView.Watchdog
{
    /// <summary>Spustí zadaný EXE do aktuální aktivní uživatelské (konzolové) session.</summary>
    internal static class SessionLauncher
    {
        public const uint INVALID_SESSION = 0xFFFFFFFF;

        public static uint ActiveSessionId()
        {
            return NativeMethods.WTSGetActiveConsoleSessionId();
        }

        /// <summary>Spustí proces v session uživatele. Vrací true při úspěchu.</summary>
        public static bool LaunchInSession(uint sessionId, string exePath, string workingDir, out string error)
        {
            error = null;
            IntPtr userToken = IntPtr.Zero;
            IntPtr dupToken = IntPtr.Zero;
            IntPtr env = IntPtr.Zero;

            try
            {
                if (sessionId == INVALID_SESSION)
                {
                    error = "Žádná aktivní session.";
                    return false;
                }
                if (!NativeMethods.WTSQueryUserToken(sessionId, out userToken))
                {
                    error = "WTSQueryUserToken selhalo (" + Marshal2() + ").";
                    return false;
                }

                var sa = new NativeMethods.SECURITY_ATTRIBUTES();
                sa.nLength = System.Runtime.InteropServices.Marshal.SizeOf(sa);

                if (!NativeMethods.DuplicateTokenEx(userToken, NativeMethods.MAXIMUM_ALLOWED, ref sa,
                        NativeMethods.SECURITY_IMPERSONATION_LEVEL.SecurityIdentification,
                        NativeMethods.TOKEN_TYPE.TokenPrimary, out dupToken))
                {
                    error = "DuplicateTokenEx selhalo (" + Marshal2() + ").";
                    return false;
                }

                NativeMethods.CreateEnvironmentBlock(out env, dupToken, false);

                var si = new NativeMethods.STARTUPINFO();
                si.cb = System.Runtime.InteropServices.Marshal.SizeOf(si);
                si.lpDesktop = @"winsta0\default";

                NativeMethods.PROCESS_INFORMATION pi;
                bool ok = NativeMethods.CreateProcessAsUser(
                    dupToken, exePath, null, ref sa, ref sa, false,
                    NativeMethods.CREATE_UNICODE_ENVIRONMENT | NativeMethods.CREATE_NO_WINDOW,
                    env, workingDir, ref si, out pi);

                if (!ok)
                {
                    error = "CreateProcessAsUser selhalo (" + Marshal2() + ").";
                    return false;
                }

                NativeMethods.CloseHandle(pi.hProcess);
                NativeMethods.CloseHandle(pi.hThread);
                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
            finally
            {
                if (env != IntPtr.Zero) NativeMethods.DestroyEnvironmentBlock(env);
                if (dupToken != IntPtr.Zero) NativeMethods.CloseHandle(dupToken);
                if (userToken != IntPtr.Zero) NativeMethods.CloseHandle(userToken);
            }
        }

        private static int Marshal2()
        {
            return System.Runtime.InteropServices.Marshal.GetLastWin32Error();
        }
    }
}
