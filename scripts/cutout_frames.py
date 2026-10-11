"""Cut the portrait out of every gaze frame so page layers can sit behind it.

Reads the opaque large-tier stills from public/portraits/gaze-video/large, removes the
backdrop with rembg's isnet-general-use model, and writes alpha WebP for both tiers to
public/portraits/cutout/. The standard tier is downscaled from the large matte so both
tiers share one silhouette. Writes docs/cutout/manifest.json with sizes and hashes.

    pip install "rembg[cpu]" pillow
    python scripts/cutout_frames.py
"""
import hashlib
import json
from pathlib import Path

from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public/portraits/gaze-video/large'
OUT_PUBLIC = ROOT / 'public/portraits/cutout'
OUT_DOCS = ROOT / 'docs/cutout'
MODEL = 'isnet-general-use'
TIERS = {'large': (1152, 768, 80), 'standard': (768, 512, 80)}


def main() -> None:
    session = new_session(MODEL)
    files = {}
    for source in sorted(SOURCE.glob('*.webp')):
        name = source.stem
        cut = remove(Image.open(source).convert('RGB'), session=session, post_process_mask=True)
        files[name] = {}
        for tier, (w, h, quality) in TIERS.items():
            target = OUT_PUBLIC / tier / f'{name}.webp'
            target.parent.mkdir(parents=True, exist_ok=True)
            frame = cut if cut.size == (w, h) else cut.resize((w, h), Image.LANCZOS)
            frame.save(target, 'WEBP', quality=quality, alpha_quality=90, method=6)
            data = target.read_bytes()
            files[name][tier] = {'url': f'/portraits/cutout/{tier}/{name}.webp', 'bytes': len(data),
                                 'sha256': hashlib.sha256(data).hexdigest()}
        print(name, flush=True)
    OUT_DOCS.mkdir(parents=True, exist_ok=True)
    manifest = {'model': MODEL, 'source': 'public/portraits/gaze-video/large',
                'tiers': {t: {'width': w, 'height': h, 'quality': q} for t, (w, h, q) in TIERS.items()},
                'files': files}
    (OUT_DOCS / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')


if __name__ == '__main__':
    main()
