import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, AlertController, LoadingController } from 'ionic-angular';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import 'rxjs/add/operator/take'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/mergeMap'
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, AsyncSubject, BehaviorSubject } from "rxjs";
import { DocumentViewPage } from "../document-view/document-view";
import * as firebase from 'firebase';
import { FileOpener } from '@ionic-native/file-opener';
import { FirebaseApp } from 'angularfire2';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';

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
  private readonly REF_BASE = 'disclosures';

  fileTransfer: FileTransferObject;
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

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private dp: DisclosureProvider,
    private platform: Platform,
    private fileOpener: FileOpener,
    private app: FirebaseApp,
    private alertCtrl: AlertController,
    private transfer: FileTransfer,
    private file: File,
    private afDB: AngularFireDatabase,
    private loadingCtrl: LoadingController,
  ) {
    this.queryBase = afDB.database.ref(this.REF_BASE).orderByChild('code').equalTo(navParams.get('code')).limitToLast(20);
    this.queryBase.once('value').then(this.updateItems);
    this.fileTransfer = this.transfer.create();
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

  viewDocument(item) {
    if(this.platform.is('cordova')) {
      const loading = this.loadingCtrl.create({
        content: 'ファイルをダウンロード中',
        enableBackdropDismiss: true,
        dismissOnPageChange: true,
      })
      loading.present();
      Observable.fromPromise(this.app.storage().ref().child(`/disclosures/${item.document}.pdf`).getDownloadURL())
      .do(e => console.log(e))
      .mergeMap(url => this.fileTransfer.download(url, this.file.dataDirectory + item.document + '.pdf'))
      .catch(err => {
        let alert = this.alertCtrl.create({
          title: 'Error',
          subTitle: err.message,
          buttons: ['Dismiss'],
        });
        loading.dismiss()
        alert.present();
        throw err;
      })
      .subscribe(entry => {
        console.log(entry.toURL());
        loading.dismiss()
        this.fileOpener.open(entry.toURL(), 'application/pdf');
      })
    } else {
      this.navCtrl.push(DocumentViewPage, item);
    }
  }

}
