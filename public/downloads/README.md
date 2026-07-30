# MLC-VISTA client applications

This directory is the same-origin client distribution authority for a
self-hosted VISTA node. Place signed client packages here before rebuilding
the OCI image.

Version 1.0.0 default filenames:

- `MLC-VISTA_1.0.0_x64-setup.exe`
- `MLC-VISTA_1.0.0_x64_en-US.msi`
- `MLC-VISTA_1.0.0_aarch64.dmg`
- `MLC-VISTA_1.0.0_x64.dmg`
- `MLC-VISTA_1.0.0_amd64.AppImage`
- `MLC-VISTA_1.0.0_aarch64.AppImage`

The web UI uses `/api/download`, which redirects only to this same-origin
directory on self-hosted nodes. Upstream hosts retain their release service.
