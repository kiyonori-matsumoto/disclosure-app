import { Component } from '@angular/core';
import { NavController, Platform } from 'ionic-angular';
import { FirebaseListObservable, AngularFireDatabase } from "angularfire2/database";
import { DocumentListPageModule } from "../document-list/document-list.module";
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
  items: FirebaseListObservable<any[]>;
  tab = {
    document: DocumentStreamPage,
    topics: ListTopicsPage,
    setting: SettingPage,
  }

  constructor(public navCtrl: NavController, afDB: AngularFireDatabase, fcm: FCM, platform: Platform) {
    if(platform.is('cordova')) {
      fcm.onNotification().subscribe(data => {
        const code = data.tag.split('_')[1];
        console.log(code);
        navCtrl.push('DocumentListPage', { code });
      })
    }
  }

}
