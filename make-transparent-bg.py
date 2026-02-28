#!/usr/bin/env python3
"""
Makes black background transparent in a PNG image.
Uses flood-fill from corners to identify background black (not the black
in the design like outlines/eyes) and replaces it with full transparency.
"""

import os
import sys
from PIL import Image
import numpy as np


def make_black_background_transparent(input_path, output_path=None):
    """Replace black background with transparency, preserving design elements."""
    if output_path is None:
        output_path = input_path.replace('.png', '-transparent.png')
    
    img = Image.open(input_path)
    img = img.convert('RGBA')
    data = np.array(img)
    
    # Threshold: pixels darker than this are considered "black" for flood fill
    # Use a low threshold to only match true black background, not dark outlines
    black_threshold = 25
    
    def is_black(pixel):
        r, g, b = pixel[0], pixel[1], pixel[2]
        return r <= black_threshold and g <= black_threshold and b <= black_threshold
    
    height, width = data.shape[:2]
    visited = np.zeros((height, width), dtype=bool)
    
    # Flood fill from all 4 corners and edges - background black touches edges
    from collections import deque
    
    def flood_fill_background():
        """Mark all background black pixels (connected to edges)."""
        queue = deque()
        # Add all edge pixels that are black
        for x in range(width):
            for y in [0, height - 1]:
                if is_black(data[y, x]) and not visited[y, x]:
                    queue.append((x, y))
                    visited[y, x] = True
        for y in range(height):
            for x in [0, width - 1]:
                if is_black(data[y, x]) and not visited[y, x]:
                    queue.append((x, y))
                    visited[y, x] = True
        
        while queue:
            x, y = queue.popleft()
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and not visited[ny, nx]:
                    if is_black(data[ny, nx]):
                        visited[ny, nx] = True
                        queue.append((nx, ny))
    
    flood_fill_background()
    
    # Make background pixels fully transparent
    for y in range(height):
        for x in range(width):
            if visited[y, x]:
                data[y, x, 3] = 0  # Set alpha to 0
    
    result = Image.fromarray(data, 'RGBA')
    result.save(output_path, 'PNG')
    print(f'Saved: {output_path}')
    return output_path


if __name__ == '__main__':
    input_file = sys.argv[1] if len(sys.argv) > 1 else None
    if not input_file:
        # Default: use the ChatGPT-generated image
        input_file = os.path.join(
            os.path.dirname(__file__),
            '../.cursor/projects/Users-yotam-bru-Documents-Code-AntiSpoiler/assets/ChatGPT_Image_Feb_28__2026__11_44_09_AM-3406e995-eae9-43a6-9fee-dcfc78f6ca4f.png'
        )
    if not os.path.exists(input_file):
        print(f'Error: File not found: {input_file}')
        sys.exit(1)
    
    output = sys.argv[2] if len(sys.argv) > 2 else None
    make_black_background_transparent(input_file, output)
