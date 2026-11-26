# Omnira desktop

This is the Flutter desktop entrypoint for macOS, Windows and Linux. The original Electron client is preserved under `../legacy/desktop-electron` for reference.

From the project root run `python3 tools/bootstrap_flutter.py --target desktop`, then build/run the target on its matching supported OS. Shared app code is in `../packages/omnira_app`. See `../SETUP.md` for host requirements, SQLite packaging, keychain/keyring access and the API URL. macOS High Sierra 10.13.6 is not a supported Flutter desktop build/run target; use the real web frontend/backend there or a supported machine for native builds.
