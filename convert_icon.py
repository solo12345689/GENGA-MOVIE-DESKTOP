from PIL import Image
import sys
import os

def convert_to_ico(png_path, ico_path):
    img = Image.open(png_path)
    # Define standard sizes for Windows icons
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, format='ICO', sizes=sizes)
    print(f"Converted {png_path} to {ico_path}")

if __name__ == "__main__":
    convert_to_ico("frontend/public/favicon.png", "frontend/public/favicon.ico")
