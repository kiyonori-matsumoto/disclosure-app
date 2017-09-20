import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import 'rxjs/add/operator/take'
import 'rxjs/add/operator/map'
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, AsyncSubject, BehaviorSubject } from "rxjs";
import { DocumentViewPage } from "../document-view/document-view";
import * as firebase from 'firebase';

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
export class DocumentListPage implements OnInit {

  ngOnInit(): void {
    // this.num.next(20);
  }

  private readonly REF_BASE = 'disclosures';

  queryBase: firebase.database.Query;

  documentViewPage = DocumentViewPage;
  pointer: any = '';

  items : any[] = []

  updateItems = (e: firebase.database.DataSnapshot) => {
    const val = e.val();
    console.log(val, this.pointer);
    this.items.push(... Object.keys(val).map(key => val[key]).sort((a, b) => b.time - a.time));
    this.pointer = this.items[this.items.length - 1].time
  }

  constructor(public navCtrl: NavController, public navParams: NavParams, afDB: AngularFireDatabase) {
    this.queryBase = afDB.database.ref(this.REF_BASE).orderByKey().limitToLast(20);
    this.queryBase.once('value').then(this.updateItems);
  }
  
  doInfinite(infiniteScroll) {
    console.log('doInfinite');
    this.queryBase.endAt(this.pointer).once('value').then(e => {
      this.updateItems(e);
      infiniteScroll.complete();
    });
  }

  doRefresh(refresh) {
    console.log('doRefresh');
    this.queryBase.once('value').then(e => {
      this.items = [];
      this.updateItems(e);
      refresh.complete();
    });
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentListPage');
  }

}
