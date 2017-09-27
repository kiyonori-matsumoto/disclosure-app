import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';

import { HomePage } from '../pages/home/home';
import { AuthProvider } from "../providers/auth/auth";
import { FCM } from '@ionic-native/fcm';
import { AngularFireDatabase } from 'angularfire2/database';
import { AngularFireAuth } from 'angularfire2/auth';

@Component({
  templateUrl: 'app.html'
})
export class MyApp {
  rootPage:any = HomePage;

  constructor(
    platform: Platform,
    statusBar: StatusBar,
    splashScreen: SplashScreen,
    auth: AuthProvider,
    fcm: FCM,
    private afDb: AngularFireDatabase,
    private afAuth: AngularFireAuth,
  ) {
    platform.ready().then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault();
      splashScreen.hide();
      if(platform.is('cordova')) {
        fcm.onTokenRefresh().subscribe((token) => {
          console.log(token)
          this.afAuth.authState.subscribe(d => {
            const uid = d.uid;
            if(uid) {
              afDb.object(`/user/tokens/${uid}/`).set(token).then(console.log);
            }
          })
        });
      }
    });
  }
}

