import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import 'rxjs/add/operator/take'
import 'rxjs/add/operator/map'
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable } from "rxjs";
import { DocumentViewPage } from "../document-view/document-view";

/**
 * Generated class for the DocumentListPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-document-list',
  templateUrl: 'document-list.html',
})
export class DocumentListPage {

  items: Observable<any[]>;
  documentViewPage = DocumentViewPage;
  constructor(public navCtrl: NavController, public navParams: NavParams, dp: DisclosureProvider) {
    this.items = dp.all();
  }
  

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentListPage');
  }

}
