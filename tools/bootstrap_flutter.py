"""Generate platform runners using the installed Flutter SDK, preserving app code."""
import argparse
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ANDROID = 'http://schemas.android.com/apk/res/android'
ET.register_namespace('android', ANDROID)


def android_permissions(directory):
    manifest = directory / 'android/app/src/main/AndroidManifest.xml'
    if manifest.exists():
        tree = ET.parse(manifest)
        root = tree.getroot()
        if not any(node.get(f'{{{ANDROID}}}name') == 'android.permission.INTERNET' for node in root.findall('uses-permission')):
            ET.SubElement(root, 'uses-permission', {f'{{{ANDROID}}}name': 'android.permission.INTERNET'})
        tree.write(manifest, encoding='unicode')
    # HTTP is for local debug only; release builds must use an HTTPS API URL.
    manifest = directory / 'android/app/src/debug/AndroidManifest.xml'
    if manifest.exists():
        tree = ET.parse(manifest)
        root = tree.getroot()
        application = root.find('application')
        if application is None:
            application = ET.SubElement(root, 'application')
        application.set(f'{{{ANDROID}}}usesCleartextTraffic', 'true')
        tree.write(manifest, encoding='unicode')


def mac_permissions(directory):
    for path in (directory / 'macos/Runner').glob('*.entitlements'):
        values = plistlib.loads(path.read_bytes())
        values['com.apple.security.network.client'] = True
        values['com.apple.security.files.user-selected.read-write'] = True
        values['keychain-access-groups'] = ['$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)']
        path.write_bytes(plistlib.dumps(values))
    runner = directory / 'ios/Runner'
    if runner.is_dir():
        entitlements = runner / 'Runner.entitlements'
        if not entitlements.exists():
            entitlements.write_bytes(plistlib.dumps({'keychain-access-groups': ['$(AppIdentifierPrefix)$(PRODUCT_BUNDLE_IDENTIFIER)']}))
        project = directory / 'ios/Runner.xcodeproj/project.pbxproj'
        if project.exists():
            text = project.read_text()
            if 'CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;' not in text:
                text = text.replace('PRODUCT_BUNDLE_IDENTIFIER = ', 'CODE_SIGN_ENTITLEMENTS = Runner/Runner.entitlements;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ')
                project.write_text(text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--target', choices=['mobile', 'desktop', 'all'], default='all')
    parser.add_argument('--no-pub', action='store_true')
    args = parser.parse_args()
    flutter = shutil.which('flutter')
    if not flutter:
        raise SystemExit('Flutter SDK is not on PATH. Install Flutter on a supported build machine first; see SETUP.md.')
    targets = ['mobile', 'desktop'] if args.target == 'all' else [args.target]
    for target in targets:
        directory = ROOT / target
        original = {path: path.read_bytes() for path in [directory / 'pubspec.yaml', directory / 'lib/main.dart']}
        platforms = 'android,ios' if target == 'mobile' else 'macos,windows,linux'
        try:
            subprocess.run([flutter, 'create', '--no-pub', '--org', 'com.omnira', '--project-name', f'omnira_{target}', f'--platforms={platforms}', '.'], cwd=directory, check=True)
        finally:
            for path, data in original.items():
                path.write_bytes(data)
        default_test = directory / 'test/widget_test.dart'
        if default_test.exists() and 'MyApp' in default_test.read_text():
            default_test.unlink()
        android_permissions(directory)
        mac_permissions(directory)
        if not args.no_pub:
            subprocess.run([flutter, 'pub', 'get'], cwd=directory, check=True)
    print('Platform runners are ready. Read SETUP.md for device URLs and platform build requirements.')

if __name__ == '__main__':
    main()
