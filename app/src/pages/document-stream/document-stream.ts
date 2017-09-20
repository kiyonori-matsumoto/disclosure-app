import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { FirebaseListObservable } from "angularfire2/database";
import { Observable } from "rxjs";
import { DocumentViewPage } from '../document-view/document-view';
import * as moment from 'moment';

/**
 * Generated class for the DocumentStreamPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-document-stream',
  templateUrl: 'document-stream.html',
})
export class DocumentStreamPage {

  items: Observable<any[]>;
  date: string;
  documentViewPage = DocumentViewPage;

  constructor(public navCtrl: NavController, public navParams: NavParams, private dp: DisclosureProvider) {
    this.date = moment().format("YYYY-MM-DD");
    this.items = dp.by_date(this.date).map(e => e.reverse()); //dp.all(50).map(e => e.reverse());
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentStreamPage');
  }

  onChangeDate() {
    console.log(this.date);
    this.items = this.dp.by_date(this.date).map(e => e.reverse()); //dp.all(50).map
  }

}
