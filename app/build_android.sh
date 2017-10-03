rm disclosure.apk -f
ionic cordova build android --prod --release
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ~/my-release-key.jks platforms/android/build/outputs/apk/android-release-unsigned.apk my-release
~/Android/Sdk/build-tools/26.0.1/zipalign -v 4 platforms/android/build/outputs/apk/android-release-unsigned.apk disclosure.apk
