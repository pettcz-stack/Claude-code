using System.Text;

namespace WorkView.Agent
{
    /// <summary>Jeden agregovaný záznam za interval. Žádný obsah – jen metriky.</summary>
    internal sealed class IntervalRecord
    {
        public string IntervalStartIso;   // UTC ISO 8601
        public int IntervalSeconds;
        public int ActiveSeconds;
        public int IdleSeconds;
        public string ForegroundApp;      // název procesu, např. "winword.exe" (bez titulku okna)
        public long KeystrokeCount;        // POČET úhozů (nikdy obsah)
        public long MouseEvents;           // POČET pohybů/kliků (nikdy souřadnice)
        public bool SessionLocked;

        public string ToJson()
        {
            StringBuilder sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"intervalStart\":").Append(Json.Str(IntervalStartIso)).Append(',');
            sb.Append("\"intervalSeconds\":").Append(Json.Num(IntervalSeconds)).Append(',');
            sb.Append("\"activeSeconds\":").Append(Json.Num(ActiveSeconds)).Append(',');
            sb.Append("\"idleSeconds\":").Append(Json.Num(IdleSeconds)).Append(',');
            sb.Append("\"foregroundApp\":").Append(Json.Str(ForegroundApp)).Append(',');
            sb.Append("\"keystrokeCount\":").Append(Json.Num(KeystrokeCount)).Append(',');
            sb.Append("\"mouseEvents\":").Append(Json.Num(MouseEvents)).Append(',');
            sb.Append("\"sessionLocked\":").Append(Json.Bool(SessionLocked));
            sb.Append('}');
            return sb.ToString();
        }
    }
}
