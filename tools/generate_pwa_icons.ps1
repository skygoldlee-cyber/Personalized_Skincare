# PWA icon generator using inline C# (avoids PowerShell .NET interop quirks)
$code = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public class IconGen {
    public static void Main(string[] args) {
        string outDir = args[0];
        Directory.CreateDirectory(outDir);
        Gen(192, Path.Combine(outDir, "icon-192.png"), false);
        Gen(512, Path.Combine(outDir, "icon-512.png"), false);
        Gen(512, Path.Combine(outDir, "icon-maskable-512.png"), true);
        Console.WriteLine("DONE");
    }

    static void Gen(int size, string path, bool maskable) {
        using (var bmp = new Bitmap(size, size))
        using (var g = Graphics.FromImage(bmp)) {
            g.SmoothingMode = SmoothingMode.AntiAlias;

            if (maskable) {
                using (var bg = new SolidBrush(Color.FromArgb(11, 15, 25)))
                    g.FillRectangle(bg, 0, 0, size, size);
            }

            double scale = maskable ? 0.66 : 1.0;
            int badge = (int)(size * scale);
            int off = (size - badge) / 2;
            var rect = new Rectangle(off, off, badge, badge);

            using (var brush = new LinearGradientBrush(rect,
                Color.FromArgb(6, 182, 212), Color.FromArgb(139, 92, 246),
                LinearGradientMode.ForwardDiagonal)) {

                if (maskable) {
                    g.FillEllipse(brush, rect);
                } else {
                    int r = (int)(badge * 0.22);
                    using (var p = new GraphicsPath()) {
                        p.AddArc(off, off, r * 2, r * 2, 180, 90);
                        p.AddArc(off + badge - r * 2, off, r * 2, r * 2, 270, 90);
                        p.AddArc(off + badge - r * 2, off + badge - r * 2, r * 2, r * 2, 0, 90);
                        p.AddArc(off, off + badge - r * 2, r * 2, r * 2, 90, 90);
                        p.CloseFigure();
                        g.FillPath(brush, p);
                    }
                }
            }

            float cx = size / 2f, cy = size / 2f;
            float s = badge / 512f;

            using (var pen = new Pen(Color.White, 46f * s)) {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                g.DrawLine(pen, cx - 120f * s, cy + 120f * s, cx + 70f * s, cy - 70f * s);
            }

            using (var white = new SolidBrush(Color.White)) {
                Sparkle(g, white, cx + 130f * s, cy - 130f * s, 70f * s);
                Sparkle(g, white, cx + 30f * s, cy + 130f * s, 34f * s);
                Sparkle(g, white, cx - 130f * s, cy - 40f * s, 26f * s);
            }

            bmp.Save(path, ImageFormat.Png);
            Console.WriteLine("OK " + path);
        }
    }

    static void Sparkle(Graphics g, Brush b, float px, float py, float r) {
        var pts = new PointF[8];
        for (int i = 0; i < 8; i++) {
            double ang = Math.PI / 4.0 * i - Math.PI / 2.0;
            double rad = (i % 2 == 0) ? r : r * 0.35;
            pts[i] = new PointF((float)(px + rad * Math.Cos(ang)), (float)(py + rad * Math.Sin(ang)));
        }
        g.FillPolygon(b, pts);
    }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$outDir = Join-Path $PSScriptRoot "..\icons"
[IconGen]::Main(@($outDir))
