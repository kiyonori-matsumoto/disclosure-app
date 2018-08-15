#!/bin/bash -xe
rm disclosure.apk -f
ionic cordova build android --prod --release
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ~/my-release-key.jks platforms/android/build/outputs/apk/release/android-release-unsigned.apk my-release
~/Android/Sdk/build-tools/28.0.2/zipalign -v 4 platforms/android/build/outputs/apk/release/android-release-unsigned.apk disclosure.apk
