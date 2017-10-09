import { Component, ViewChild } from '@angular/core';
import { NavController, Platform } from 'ionic-angular';
import { DocumentListPage } from "../document-list/document-list";
import { SettingPage } from "../setting/setting";
import { DocumentStreamPage } from '../document-stream/document-stream';
import { ListTopicsPage } from '../list-topics/list-topics';
import { FCM } from '@ionic-native/fcm';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  tab = {
    document: DocumentStreamPage,
    topics: ListTopicsPage,
    setting: SettingPage,
  }

  @ViewChild('myNav') nav: NavController;

  constructor(fcm:FCM, platform: Platform ) {
    // if(platform.is('cordova')) {
    //   fcm.onNotification().subscribe(data => {
    //     const code = data.tag.split('_')[1];
    //     console.log(code);
    //     navCtrl.push('DocumentListPage', { code });
    //   })
    // }
    if(platform.is('cordova')) {
      platform.ready().then(() => {
        fcm.onNotification().subscribe(data => {
          console.log(JSON.stringify(data));

          const code = data.code;
          console.log(code);
          this.nav.push(DocumentListPage, { code }, {});
        })
      })
    }
  }

}
