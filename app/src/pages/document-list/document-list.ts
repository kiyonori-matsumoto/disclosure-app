import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import 'rxjs/add/operator/take'
import 'rxjs/add/operator/map'
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, AsyncSubject, BehaviorSubject } from "rxjs";
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
export class DocumentListPage implements OnInit {

  ngOnInit(): void {
    this.num.next(20);
  }

  items: Observable<any>;
  documentViewPage = DocumentViewPage;
  num: BehaviorSubject<number>;
  n: number;
  pointer: any = '';

  items$: Observable<any>;

  constructor(public navCtrl: NavController, public navParams: NavParams, afDB: AngularFireDatabase) {
    this.num = new BehaviorSubject<number>(1);
    
    this.items$ = afDB.list('/disclosures', { query: { limitToLast: this.num.scan((a, e) => a + e, 0), orderByChild: 'time' }});
    this.items = this.items$.map(e => e.reverse())
  }
  
  doInfinite(infiniteScroll) {
    this.num.next(20);
    this.items$.subscribe(e => infiniteScroll.complete());
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentListPage');
  }

}
