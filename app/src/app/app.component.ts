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
import { DocumentStreamPage } from '../pages/document-stream/document-stream';
import { SettingPage } from '../pages/setting/setting';
import { DocumentListPage } from '../pages/document-list/document-list';
import { FavoritesPage } from '../pages/favorites/favorites';

@Component({
  templateUrl: 'app.html'
})
export class MyApp {
  rootPage:any = DocumentStreamPage;

  pages: {title: string, component: any, name?: string}[];

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
    ]).then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault();
      splashScreen.hide();
      afAuth.auth.signInAnonymously().then(console.log)
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
        fcm.onNotification().subscribe(data => {
          console.log(JSON.stringify(data));

          const code = data.code;
          console.log(code);
          this.nav.push(DocumentListPage, { code }, {});
        })
      }
    });

    this.pages = [
      { title: '適時開示一覧', component: DocumentStreamPage, name: 'document' },
      { title: 'お気に入り', component: FavoritesPage, name: 'star' },
      { title: '設定', component: SettingPage, name: 'settings' },
    ]
  }

  openPage(page) {
    // Reset the content nav to have just this page
    // we wouldn't want the back button to show in this scenario
    this.nav.setRoot(page.component);
    // this.nav.push(page.component);
  }
}

