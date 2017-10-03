import { Component, ViewChild } from '@angular/core';
import { Platform, NavController } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';

import { HomePage } from '../pages/home/home';
import { AuthProvider } from "../providers/auth/auth";
import { FCM } from '@ionic-native/fcm';
import { AngularFireDatabase } from 'angularfire2/database';
import { AngularFireAuth } from 'angularfire2/auth';
import { FcmProvider } from '../providers/fcm/fcm';

@Component({
  templateUrl: 'app.html'
})
export class MyApp {
  rootPage:any = HomePage;

  @ViewChild('myNav') nav: NavController

  constructor(
    platform: Platform,
    statusBar: StatusBar,
    splashScreen: SplashScreen,
    auth: AuthProvider,
    fcm: FCM,
    private afDb: AngularFireDatabase,
    private afAuth: AngularFireAuth,
    fcmProvider: FcmProvider,
  ) {
    Promise.all([
      platform.ready(),
      afAuth.auth.signInAnonymously(),
    ]).then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault();
      splashScreen.hide();
      if(platform.is('cordova')) {
        const uploadToken = (token) => {
          console.log(token)
          this.afAuth.authState.subscribe(d => {
            const uid = d.uid;
            if(uid) {
              afDb.object(`/user/tokens/${uid}/`).set(token).then(console.log);
            }
          })
        };
        fcm.onTokenRefresh().subscribe(uploadToken);
        fcm.getToken().then(uploadToken);
      }
    });
  }
}

