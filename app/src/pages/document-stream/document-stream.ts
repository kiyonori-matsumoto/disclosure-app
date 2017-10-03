import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, AlertController, LoadingController } from 'ionic-angular';
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { FirebaseListObservable } from "angularfire2/database";
import { Observable } from "rxjs";
import { DocumentViewPage } from '../document-view/document-view';
import * as moment from 'moment';
import { SearchStocksPage } from '../search-stocks/search-stocks';
// import { DocumentViewer } from '@ionic-native/document-viewer';
import { FileOpener } from '@ionic-native/file-opener';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { FirebaseApp } from 'angularfire2';

import 'rxjs/add/operator/mergeMap'

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
  searchStocksPage = SearchStocksPage;
  fileTransfer: FileTransferObject;
  loading: Observable<boolean>;

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
    private loadingCtrl: LoadingController,
  ) {
    this.date = moment().format("YYYY-MM-DD");
    this.updateItems();
  }

  ionViewDidLoad() {
    if(this.platform.is('cordova')) {
      this.platform.ready().then(() => {
        this.fileTransfer = this.transfer.create();
      })
    }
    console.log('ionViewDidLoad DocumentStreamPage');
  }

  onChangeDate() {
    console.log(this.date);
    this.updateItems();
  }

  private updateItems() {
    this.items = this.dp.by_date(this.date).map(e => e.reverse()).share();
    this.loading  = this.items.map(() => false).startWith(true);
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
