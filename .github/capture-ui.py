"""Capture the player-visible launch flow on the CI emulator."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

def adb(*args):
    return subprocess.check_output(["adb", *args])

def tap(label):
    for _ in range(12):
        adb("shell", "uiautomator", "dump", "/sdcard/window.xml")
        root = ET.fromstring(adb("shell", "cat", "/sdcard/window.xml"))
        for node in root.iter("node"):
            if node.get("text", "").lower() == label.lower():
                left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
                adb("shell", "input", "tap", str((left + right)//2), str((top + bottom)//2))
                return
        time.sleep(.5)
    raise RuntimeError("Could not find " + label)

def capture(name):
    Path("preview", name + ".png").write_bytes(adb("exec-out", "screencap", "-p"))

Path("preview").mkdir(exist_ok=True)
adb("shell", "wm", "size", "720x1440")
adb("shell", "wm", "density", "320")
adb("install", "-r", "app/build/outputs/apk/debug/app-debug.apk")
adb("shell", "am", "start", "-W", "-n", "com.ashmaz.shipahead.volcanicmath/.MainActivity")
time.sleep(2)
capture("01-home")
tap("Start game")
time.sleep(.6)
capture("02-setup")
tap("Launch voyage")
time.sleep(7)
capture("03-follow")
tap("Island view")
time.sleep(1)
capture("04-overview")
