// Remote Harness notification-area icon for Windows. The daemon in WSL starts it through interop
// (powershell.exe compiles this file with Add-Type) and sends the menu as JSON lines on stdin; clicks
// go back as JSON lines on stdout. It quits when stdin closes (the daemon stopped). Add-Type in
// Windows PowerShell compiles C# 5 against .NET Framework: no newer syntax here.
using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

namespace RemoteHarness
{
    public static class TrayApp
    {
        /// <summary>Runs the icon until stdin closes.</summary>
        public static void Run()
        {
            Application.EnableVisualStyles();
            using (Tray tray = new Tray())
            {
                tray.Start();
                Application.Run();
            }
        }
    }

    internal sealed class Tray : IDisposable
    {
        private const string PersonalizeKey =
            @"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize";

        private readonly NotifyIcon icon = new NotifyIcon();
        private readonly ContextMenuStrip menu = new ContextMenuStrip();
        /// <summary>Owns a window handle on the UI thread, so the reader thread can post to it.</summary>
        private readonly Control invoker = new Control();
        private readonly StreamWriter output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false));
        private readonly object outputLock = new object();
        private string state = "idle";
        private Icon current;
        /// <summary>A menu that arrived while the menu was open: applied when it closes.</summary>
        private IList pendingItems;

        public void Start()
        {
            IntPtr handle = invoker.Handle;
            if (handle == IntPtr.Zero) throw new InvalidOperationException("no window handle");
            icon.Text = "Remote Harness";
            icon.ContextMenuStrip = menu;
            icon.MouseUp += OnMouseUp;
            menu.Closed += OnMenuClosed;
            SetIcon("idle");
            icon.Visible = true;
            SystemEvents.UserPreferenceChanged += OnPreferenceChanged;
            Thread reader = new Thread(ReadInput);
            reader.IsBackground = true;
            reader.Start();
            Dictionary<string, object> ready = new Dictionary<string, object>();
            ready["type"] = "ready";
            Emit(ready);
        }

        public void Dispose()
        {
            SystemEvents.UserPreferenceChanged -= OnPreferenceChanged;
            icon.Visible = false;
            icon.Dispose();
            menu.Dispose();
            if (current != null) current.Dispose();
            invoker.Dispose();
        }

        private void ReadInput()
        {
            JavaScriptSerializer json = new JavaScriptSerializer();
            json.MaxJsonLength = int.MaxValue;
            using (StreamReader reader = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    Dictionary<string, object> message;
                    try
                    {
                        message = json.DeserializeObject(line) as Dictionary<string, object>;
                    }
                    catch (Exception)
                    {
                        continue;
                    }
                    if (message != null) invoker.BeginInvoke(new Action<Dictionary<string, object>>(Apply), message);
                }
            }
            invoker.BeginInvoke(new Action(Application.ExitThread));
        }

        private void Apply(Dictionary<string, object> message)
        {
            try
            {
                string type = Str(message, "type");
                if (type == "menu")
                {
                    string next = Str(message, "icon") ?? "idle";
                    if (next != state) SetIcon(next);
                    string tooltip = Str(message, "tooltip") ?? "Remote Harness";
                    // NotifyIcon refuses tooltips of 64 characters or more.
                    icon.Text = tooltip.Length > 63 ? tooltip.Substring(0, 63) : tooltip;
                    IList items = List(message, "items") ?? new object[0];
                    if (menu.Visible) pendingItems = items;
                    else Rebuild(items);
                }
                else if (type == "notify")
                {
                    string title = Str(message, "title") ?? "";
                    string body = Str(message, "body") ?? "";
                    // A balloon needs text: a title alone becomes the text.
                    if (body.Length == 0 && title.Length == 0) return;
                    if (body.Length == 0) icon.ShowBalloonTip(5000, "", title, ToolTipIcon.None);
                    else icon.ShowBalloonTip(5000, title, body, ToolTipIcon.None);
                }
            }
            catch (Exception error)
            {
                Console.Error.WriteLine("tray: " + error.Message);
            }
        }

        private void Rebuild(IList items)
        {
            menu.SuspendLayout();
            menu.Items.Clear();
            Build(menu.Items, items);
            menu.ResumeLayout();
        }

        private void OnMenuClosed(object sender, ToolStripDropDownClosedEventArgs e)
        {
            if (pendingItems == null) return;
            IList items = pendingItems;
            pendingItems = null;
            Rebuild(items);
        }

        private void Build(ToolStripItemCollection target, IList items)
        {
            foreach (object raw in items)
            {
                Dictionary<string, object> item = raw as Dictionary<string, object>;
                if (item == null) continue;
                string type = Str(item, "type");
                if (type == "separator")
                {
                    target.Add(new ToolStripSeparator());
                    continue;
                }
                // QR codes are only sent to helpers that draw them (macOS).
                if (type == "qr") continue;
                // `&` would underline the next letter as a mnemonic.
                ToolStripMenuItem entry = new ToolStripMenuItem((Str(item, "label") ?? "").Replace("&", "&&"));
                if (type == "submenu")
                {
                    Build(entry.DropDownItems, List(item, "items") ?? new object[0]);
                }
                else
                {
                    entry.Enabled = Bool(item, "enabled", true);
                    entry.Checked = Bool(item, "checked", false);
                    string id = Str(item, "id");
                    if (id != null) entry.Click += delegate { Click(id); };
                }
                target.Add(entry);
            }
        }

        private void Click(string id)
        {
            Dictionary<string, object> click = new Dictionary<string, object>();
            click["type"] = "click";
            click["id"] = id;
            Emit(click);
        }

        private void Emit(Dictionary<string, object> message)
        {
            string line = new JavaScriptSerializer().Serialize(message);
            lock (outputLock)
            {
                try
                {
                    output.Write(line + "\n");
                    output.Flush();
                }
                catch (IOException)
                {
                    // The daemon is gone: stdin closes next and the icon quits.
                }
            }
        }

        /// <summary>The menu opens on a left click too, like on the other platforms.</summary>
        private void OnMouseUp(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            MethodInfo show = typeof(NotifyIcon).GetMethod("ShowContextMenu", BindingFlags.Instance | BindingFlags.NonPublic);
            if (show != null) show.Invoke(icon, null);
        }

        private void OnPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
        {
            // The taskbar may have switched between light and dark.
            if (e.Category == UserPreferenceCategory.General)
                invoker.BeginInvoke(new Action<string>(SetIcon), state);
        }

        private void SetIcon(string next)
        {
            state = next;
            Icon previous = current;
            current = Glyph(next, LightTaskbar(), SystemInformation.SmallIconSize.Width);
            icon.Icon = current;
            if (previous != null) previous.Dispose();
        }

        private static bool LightTaskbar()
        {
            object value = Registry.GetValue(PersonalizeKey, "SystemUsesLightTheme", 0);
            return value is int && (int)value == 1;
        }

        /// <summary>
        /// The Remote Harness mark in its bold weight (three reins meeting in one ring), from the same
        /// 256-unit geometry as the app icon and the macOS glyph: white on a dark taskbar, black on a light
        /// one; the ring fills while a session works and the amber dot (the one color) means a permission
        /// waits; 40 % opacity when the daemon is gone.
        /// </summary>
        private static Icon Glyph(string state, bool light, int size)
        {
            using (Bitmap bitmap = new Bitmap(size, size))
            {
                using (Graphics g = Graphics.FromImage(bitmap))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.Clear(Color.Transparent);
                    float s = size / 256f;
                    int alpha = state == "offline" ? 102 : 255;
                    Color ink = light ? Color.FromArgb(alpha, 0, 0, 0) : Color.FromArgb(alpha, 255, 255, 255);
                    // The mark ("Cursor Signal"), bold weight, same 256-box geometry as the app icon: the
                    // cursor block, the `>` prompt punched out of it (unless a session is working: a busy
                    // cursor is solid), then the three signal arcs.
                    using (SolidBrush brush = new SolidBrush(ink))
                    using (GraphicsPath block = RoundedRect(26 * s, 60 * s, 76 * s, 136 * s, 15 * s))
                        g.FillPath(brush, block);
                    if (state != "working")
                    {
                        g.CompositingMode = CompositingMode.SourceCopy;
                        using (Pen cut = new Pen(Color.Transparent, 26 * s))
                        {
                            cut.StartCap = LineCap.Round;
                            cut.EndCap = LineCap.Round;
                            cut.LineJoin = LineJoin.Round;
                            PointF[] prompt = { new PointF(47 * s, 99 * s), new PointF(81 * s, 128 * s), new PointF(47 * s, 157 * s) };
                            g.DrawLines(cut, prompt);
                        }
                        g.CompositingMode = CompositingMode.SourceOver;
                    }
                    using (Pen pen = new Pen(ink, 28 * s))
                    {
                        pen.StartCap = LineCap.Round;
                        pen.EndCap = LineCap.Round;
                        float[] radii = { 36, 76, 116 };
                        foreach (float r in radii)
                            g.DrawArc(pen, (102 - r) * s, (128 - r) * s, 2 * r * s, 2 * r * s, -40, 80);
                    }
                    if (state == "waiting")
                    {
                        // Amber accent (#E8A33D), over the outer arc's upper end.
                        using (SolidBrush amber = new SolidBrush(Color.FromArgb(232, 163, 61)))
                            g.FillEllipse(amber, 190 * s, 12 * s, 64 * s, 64 * s);
                    }
                }
                IntPtr handle = bitmap.GetHicon();
                try
                {
                    using (Icon borrowed = Icon.FromHandle(handle)) return (Icon)borrowed.Clone();
                }
                finally
                {
                    DestroyIcon(handle);
                }
            }
        }

        private static GraphicsPath RoundedRect(float x, float y, float width, float height, float radius)
        {
            GraphicsPath path = new GraphicsPath();
            float d = radius * 2;
            path.AddArc(x, y, d, d, 180, 90);
            path.AddArc(x + width - d, y, d, d, 270, 90);
            path.AddArc(x + width - d, y + height - d, d, d, 0, 90);
            path.AddArc(x, y + height - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        private static string Str(Dictionary<string, object> map, string key)
        {
            object value;
            return map.TryGetValue(key, out value) ? value as string : null;
        }

        private static IList List(Dictionary<string, object> map, string key)
        {
            object value;
            return map.TryGetValue(key, out value) ? value as IList : null;
        }

        private static bool Bool(Dictionary<string, object> map, string key, bool fallback)
        {
            object value;
            return map.TryGetValue(key, out value) && value is bool ? (bool)value : fallback;
        }

        [DllImport("user32.dll")]
        private static extern bool DestroyIcon(IntPtr handle);
    }
}
