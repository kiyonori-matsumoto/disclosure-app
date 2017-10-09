import { Component, ChangeDetectorRef } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, AlertController, LoadingController, PopoverController } from 'ionic-angular';
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, BehaviorSubject } from "rxjs";
import { DocumentViewPage } from '../document-view/document-view';
import * as moment from 'moment';
import { SearchStocksPage } from '../search-stocks/search-stocks';
// import { DocumentViewer } from '@ionic-native/document-viewer';
import { FileOpener } from '@ionic-native/file-opener';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { FirebaseApp } from 'angularfire2';

import 'rxjs/add/operator/mergeMap'
import { PopoverFunnelPage } from '../popover-funnel/popover-funnel';

/**
 * Generated class for the DocumentStreamPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage({
  priority: 'high',
})
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

  filterConditions: any = {};
  changeTag$ = new BehaviorSubject<any>({});

  object = Object;

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
    private popoverCtrl: PopoverController,
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
    // this.changeTag$.subscribe(() => this.ref.detectChanges());
    // this.changeTag$.next(this.filterConditions);
  }

  onChangeDate() {
    console.log(this.date);
    this.updateItems();
  }

  addTag(tag) {
    this.filterConditions[tag] = true;
    this.changeTag$.next(Object.assign({}, this.filterConditions));
  }

  private updateItems() {
    const share = this.dp.by_date(this.date).share(); 
    this.items = Observable.combineLatest(
      share,
      this.changeTag$.asObservable()
    ).map(([docs, tags]) => {
      console.log(tags);
      const tagList = Object.keys(tags).filter(e => tags[e]);
      if(tagList.length === 0) return docs;
      return <any>docs.filter((doc: any) => tagList.some(tag => doc.tags[tag]))
    });
    // ).do(console.log).map(([docs, tags]) => docs);
    this.loading  = share.map(() => false).startWith(true);
  }

  onFunnelClick(ev: UIEvent) {
    let popover = this.popoverCtrl.create(PopoverFunnelPage, {
      tags: ['株主優待', '決算', '配当', '業績予想', '日々の開示事項'],
      tagCtrl: this.filterConditions,
      change$: this.changeTag$,
    })
    popover.present({ev: ev});
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
