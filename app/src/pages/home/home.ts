import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { FirebaseListObservable, AngularFireDatabase } from "angularfire2/database";
import { DocumentListPageModule } from "../document-list/document-list.module";
import { DocumentListPage } from "../document-list/document-list";
import { SettingPage } from "../setting/setting";
import { DocumentStreamPage } from '../document-stream/document-stream';

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  items: FirebaseListObservable<any[]>;
  tab = {
    document: DocumentStreamPage,
    setting: SettingPage,
  }

  constructor(public navCtrl: NavController, afDB: AngularFireDatabase) {
    this.items = afDB.list('/cuisines');
  }

}
