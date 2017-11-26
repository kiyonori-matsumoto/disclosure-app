import { Component, ViewChild } from '@angular/core';
import { Platform, NavController } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';

import { AuthProvider } from "../providers/auth/auth";
import { AngularFireDatabase } from 'angularfire2/database';
import { AngularFireAuth } from 'angularfire2/auth';
import { DocumentStreamPage } from '../pages/document-stream/document-stream';
import { SettingPage } from '../pages/setting/setting';
import { DocumentListPage } from '../pages/document-list/document-list';
import { FavoritesPage } from '../pages/favorites/favorites';
import { AdMobFree, AdMobFreeBannerConfig } from '@ionic-native/admob-free';
import { Firebase } from '@ionic-native/firebase';
import { SearchStocksPage } from '../pages/search-stocks/search-stocks';

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
    firebase: Firebase,
    private afDb: AngularFireDatabase,
    private afAuth: AngularFireAuth,
    private admob: AdMobFree,
  ) {
    Promise.all([
      platform.ready(),
    ]).then(() => {
      // Okay, so the platform is ready and our plugins are available.
      // Here you can do any higher level native things you might need.
      statusBar.styleDefault();
      splashScreen.hide();
      // afAuth.auth.signInAnonymously().then(console.log)
      if(platform.is('cordova')) {
        const uploadToken = (token) => {
          console.log(token)
          // this.afAuth.authState.subscribe(d => {
          //   const uid = d.uid;
          auth.uid$.subscribe(uid => {
            if(uid) {
              afDb.object(`/user/tokens/${uid}/`).set(token).then(console.log);
            }
          })
        };
        firebase.onTokenRefresh().subscribe(uploadToken);
        firebase.getToken().then(uploadToken);
        firebase.onNotificationOpen().subscribe(data => {
          console.log(JSON.stringify(data));

          const code = data.code;
          console.log(code);
          this.nav.push(DocumentListPage, { code }, {});
        })
        
        const bannerConfig: AdMobFreeBannerConfig = {
          isTesting: true,
          autoShow: true,
          id: 'ca-app-pub-5131663294295156/8292017322',
          
        };
        this.admob.banner.config(bannerConfig);
  
        this.admob.banner.prepare()
        .then(() => {
          // if autoshow is false, set true to show
        })
        .catch(e => console.error(e));
      }

    });

    this.pages = [
      { title: '適時開示一覧', component: DocumentStreamPage, name: 'document' },
      { title: '会社検索', component: SearchStocksPage, name: 'search' },
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

