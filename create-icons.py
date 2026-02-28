#!/usr/bin/env python3
"""
Script to generate extension icons
Requires PIL/Pillow: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("Error: PIL/Pillow is required. Install it with: pip install Pillow")
    exit(1)

def create_icon(size):
    """Create an icon with shield and X symbol"""
    # Create image with gradient background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)
    
    # Draw gradient-like background (simplified)
    for i in range(size):
        ratio = i / size
        r = int(102 + (118 - 102) * ratio)
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)
        draw.rectangle([(0, i), (size, i+1)], fill=(r, g, b))
    
    # Draw shield shape
    shield_points = [
        (size * 0.5, size * 0.2),  # Top
        (size * 0.7, size * 0.3),  # Top right
        (size * 0.7, size * 0.6),  # Bottom right
        (size * 0.5, size * 0.8),  # Bottom
        (size * 0.3, size * 0.6),  # Bottom left
        (size * 0.3, size * 0.3),  # Top left
    ]
    draw.polygon(shield_points, fill='white')
    
    # Draw X mark
    line_width = max(2, int(size * 0.15))
    # First diagonal
    draw.line([(size * 0.35, size * 0.35), (size * 0.65, size * 0.65)], 
              fill='#667eea', width=line_width)
    # Second diagonal
    draw.line([(size * 0.65, size * 0.35), (size * 0.35, size * 0.65)], 
              fill='#667eea', width=line_width)
    
    return img

def main():
    sizes = [16, 48, 128]
    for size in sizes:
        icon = create_icon(size)
        filename = f'icon{size}.png'
        icon.save(filename)
        print(f'Created {filename}')

if __name__ == '__main__':
    main()
