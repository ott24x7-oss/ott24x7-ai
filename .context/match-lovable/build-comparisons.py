from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
scenarios = ["four-web", "api-sent", "final-open"]
sizes = [(1920, 1080), (1280, 800)]
font_path = Path("C:/Windows/Fonts/segoeui.ttf")
font = ImageFont.truetype(str(font_path), 20) if font_path.exists() else ImageFont.load_default()
for scenario in scenarios:
    for width, height in sizes:
        gap, label_h, row_gap = 24, 38, 14
        sheet = Image.new("RGB", (2 * width + gap, 2 * (height + label_h) + row_gap), "#eef0f4")
        draw = ImageDraw.Draw(sheet)
        for row, theme in enumerate(("dark", "light")):
            top = row * (height + label_h + row_gap)
            left_prod = root / f"{scenario}-{theme}-{width}x{height}.png"
            left_proto = root / f"prototype-{scenario}-{theme}-{width}x{height}.png"
            with Image.open(left_prod) as im:
                sheet.paste(im.convert("RGB"), (0, top + label_h))
            with Image.open(left_proto) as im:
                sheet.paste(im.convert("RGB"), (width + gap, top + label_h))
            label = f"{theme.title()} · {width}×{height}"
            draw.text((12, top + 8), f"Production  |  {label}", fill="#172033", font=font)
            draw.text((width + gap + 12, top + 8), f"Lovable prototype  |  {label}", fill="#172033", font=font)
        out = root / f"side-by-side-{scenario}-{width}x{height}.png"
        sheet.save(out, optimize=True)
        print(out.name, sheet.size, out.stat().st_size)
