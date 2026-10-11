"""Extract cursor-tracking stills from the locked-off gaze video.

Usage (needs ffmpeg plus: pip install mediapipe opencv-python-headless numpy pillow):
    python scripts/extract_gaze_frames.py VIDEO face_landmarker.task

Pipeline:
1. Decode every frame and measure head yaw/pitch with MediaPipe Face Landmarker.
2. Drop frames with closed or closing eyes; the blink is rebuilt separately.
3. Map head pose into the controller's normalized viewer coordinates.
4. Keep a frame only when it adds pose coverage, so neighbors stay visually close.
5. Encode both resolution tiers and write the coordinate manifest the app imports.
"""
import hashlib, json, math, subprocess, sys, tempfile
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_PUBLIC = ROOT / 'public/portraits/gaze-video'
OUT_DOCS = ROOT / 'docs/gaze-video'
OUT_FRAMES = ROOT / 'src/portrait/frames.json'
TIERS = {'large': (1152, 768, 74), 'standard': (768, 512, 76)}
NEUTRAL_RANGE = range(0, 13)   # opening hold, looking at the camera
BLINK_HALF, BLINK_CLOSED = 14, 16
BLINK_MEAN_LIMIT = 0.35        # mean eyeBlink score above this reads as closing
RING_RADIUS = 0.85             # a full head turn sits short of the viewport edge
MIN_SPACING = 0.05             # minimum normalized pose distance between kept frames
EYE_BAND = [33, 133, 159, 145, 263, 362, 386, 374, 70, 300, 105, 334, 6, 168]


def analyze(frames, model):
    options = vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model)), num_faces=1,
        output_face_blendshapes=True, output_facial_transformation_matrixes=True)
    rows = []
    with vision.FaceLandmarker.create_from_options(options) as landmarker:
        for path in frames:
            result = landmarker.detect(mp.Image.create_from_file(str(path)))
            if not result.face_landmarks:
                raise SystemExit(f'No face found in {path.name}')
            m = np.array(result.facial_transformation_matrixes[0])[:3, :3]
            scores = {c.category_name: c.score for c in result.face_blendshapes[0]}
            rows.append({
                'yaw': math.degrees(math.atan2(m[0, 2], m[2, 2])),   # negative: viewer-left
                'pitch': math.degrees(math.asin(-m[1, 2])),          # positive: down
                'blink': (scores['eyeBlinkLeft'] + scores['eyeBlinkRight']) / 2,
                'landmarks': [[p.x, p.y] for p in result.face_landmarks[0]],
            })
    return rows


def median3(values):
    padded = [values[0], *values, values[-1]]
    return [sorted(padded[i:i + 3])[1] for i in range(len(values))]


def normalize(rows):
    yaw, pitch = median3([r['yaw'] for r in rows]), median3([r['pitch'] for r in rows])
    yaw0 = float(np.median([yaw[i] for i in NEUTRAL_RANGE]))
    pitch0 = float(np.median([pitch[i] for i in NEUTRAL_RANGE]))
    dyaw, dpitch = np.array(yaw) - yaw0, np.array(pitch) - pitch0
    # Per half-axis extents keep the asymmetric sweep (more down than up) on one ring.
    extent = lambda v: float(np.percentile(np.abs(v), 95)) if len(v) else 1.0
    left, right = extent(dyaw[dyaw < 0]), extent(dyaw[dyaw > 0])
    up, down = extent(dpitch[dpitch < 0]), extent(dpitch[dpitch > 0])
    points = []
    for y, p in zip(dyaw, dpitch):
        x = y / (left if y < 0 else right) * RING_RADIUS
        v = p / (up if p < 0 else down) * RING_RADIUS
        points.append((max(-1.0, min(1.0, x)), max(-1.0, min(1.0, v))))
    return points, {'yaw0': yaw0, 'pitch0': pitch0, 'left': left, 'right': right, 'up': up, 'down': down}


def select(rows, points):
    eligible = [i for i, r in enumerate(rows) if r['blink'] <= BLINK_MEAN_LIMIT]
    neutral = min(NEUTRAL_RANGE, key=lambda i: math.hypot(*points[i]))
    kept = [neutral]
    for i in eligible:
        if all(math.dist(points[i], points[k]) >= MIN_SPACING for k in kept):
            kept.append(i)
    # Farthest-point order: early loads cover the whole range coarsely, later loads refine.
    order, rest = [neutral], [k for k in kept if k != neutral]
    while rest:
        best = max(rest, key=lambda i: min(math.dist(points[i], points[o]) for o in order))
        order.append(best)
        rest.remove(best)
    return neutral, order


def eye_band_blink(neutral_img, closed_img, neutral_lm, closed_lm):
    """Move the closed eyes onto the neutral frame so the blink has no head dip."""
    h, w = neutral_img.shape[:2]
    src = np.float32([[closed_lm[i][0] * w, closed_lm[i][1] * h] for i in EYE_BAND])
    dst = np.float32([[neutral_lm[i][0] * w, neutral_lm[i][1] * h] for i in EYE_BAND])
    matrix, _ = cv2.estimateAffinePartial2D(src, dst)
    warped = cv2.warpAffine(closed_img, matrix, (w, h), borderMode=cv2.BORDER_REPLICATE)
    hull = cv2.convexHull(dst.astype(np.int32))
    mask = np.zeros((h, w), np.float32)
    cv2.fillConvexPoly(mask, hull, 1.0)
    pad = int(w * 0.018)
    mask = cv2.dilate(mask, np.ones((pad, pad), np.uint8))
    mask = cv2.GaussianBlur(mask, (0, 0), w * 0.008)[..., None]
    return (warped * mask + neutral_img * (1 - mask)).astype(np.uint8), matrix


def encode(image_bgr, name):
    rgb = Image.fromarray(cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB))
    records = {}
    for tier, (w, h, quality) in TIERS.items():
        target = OUT_PUBLIC / tier / f'{name}.webp'
        target.parent.mkdir(parents=True, exist_ok=True)
        rgb.resize((w, h), Image.LANCZOS).save(target, 'WEBP', quality=quality, method=6)
        data = target.read_bytes()
        records[tier] = {'url': f'/portraits/gaze-video/{tier}/{name}.webp', 'bytes': len(data),
                         'sha256': hashlib.sha256(data).hexdigest()}
    return records


def main(video, model):
    video, model = Path(video), Path(model)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), f'{tmp}/f%03d.png'], check=True)
        paths = sorted(Path(tmp).glob('f*.png'))
        rows = analyze(paths, model)
        points, scale = normalize(rows)
        neutral, order = select(rows, points)
        images = {i: cv2.imread(str(paths[i])) for i in {*order, BLINK_HALF, BLINK_CLOSED}}

        for old in OUT_PUBLIC.glob('*/*.webp'):
            old.unlink()
        frames, manifest = [], []
        for rank, i in enumerate(order):
            name = f'f{i:03d}'
            records = encode(images[i], name)
            x, y = points[i]
            frames.append({'name': name, 'x': round(x, 4), 'y': round(y, 4)})
            manifest.append({'name': name, 'videoFrame': i, 'loadRank': rank, 'yaw': round(rows[i]['yaw'], 2),
                             'pitch': round(rows[i]['pitch'], 2), 'x': round(x, 4), 'y': round(y, 4), 'files': records})
        blinks = {}
        for label, source in (('blink-half', BLINK_HALF), ('blink-closed', BLINK_CLOSED)):
            image, matrix = eye_band_blink(images[neutral], images[source], rows[neutral]['landmarks'], rows[source]['landmarks'])
            blinks[label] = {'videoFrame': source, 'alignedTo': neutral,
                             'affine': np.round(matrix, 4).tolist(), 'files': encode(image, label)}

        eye = np.mean([rows[neutral]['landmarks'][i] for i in (468, 473)], axis=0)
        OUT_FRAMES.write_text(json.dumps({
            'source': video.name, 'width': 1152, 'height': 768, 'neutral': f'f{neutral:03d}',
            'eyeAnchor': {'x': round(float(eye[0]), 4), 'y': round(float(eye[1]), 4)},
            'frames': frames,
        }, indent=1) + '\n')
        OUT_DOCS.mkdir(parents=True, exist_ok=True)
        (OUT_DOCS / 'manifest.json').write_text(json.dumps({
            'source': {'file': video.name, 'sha256': hashlib.sha256(video.read_bytes()).hexdigest(), 'frames': len(rows)},
            'settings': {'ringRadius': RING_RADIUS, 'minSpacing': MIN_SPACING, 'blinkMeanLimit': BLINK_MEAN_LIMIT,
                         'tiers': {t: {'width': w, 'height': h, 'quality': q} for t, (w, h, q) in TIERS.items()}},
            'poseScale': {k: round(v, 3) for k, v in scale.items()},
            'excludedForBlink': [i for i, r in enumerate(rows) if r['blink'] > BLINK_MEAN_LIMIT],
            'frames': manifest, 'blinks': blinks,
        }, indent=1) + '\n')
        (OUT_DOCS / 'poses.json').write_text(json.dumps([
            {'frame': i, 'yaw': round(r['yaw'], 2), 'pitch': round(r['pitch'], 2), 'blink': round(r['blink'], 3),
             'x': round(points[i][0], 4), 'y': round(points[i][1], 4), 'kept': i in order}
            for i, r in enumerate(rows)], indent=0) + '\n')
        print(f'neutral f{neutral:03d}, kept {len(order)} of {len(rows)} frames')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
