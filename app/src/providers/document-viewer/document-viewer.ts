import { Injectable } from '@angular/core';
import { Platform } from 'ionic-angular/platform/platform';
import { LoadingController } from 'ionic-angular/components/loading/loading-controller';
import { FirebaseApp } from 'angularfire2';

import { Observable } from 'rxjs';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { AlertController } from 'ionic-angular/components/alert/alert-controller';
import { FileOpener } from '@ionic-native/file-opener';
import { NavController } from 'ionic-angular/navigation/nav-controller';
import { Disclosure } from '../../model/Disclosure';
import { Firebase } from '@ionic-native/firebase';

/*
  Generated class for the DocumentViewerProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DocumentViewerProvider {

  private fileTransfer: FileTransferObject;

  constructor(
    private platform: Platform,
    private loadingCtrl: LoadingController,
    private app: FirebaseApp,
    private transfer: FileTransfer,
    private file: File,
    private fileOpener: FileOpener,
    private alertCtrl: AlertController,
    private firebase: Firebase,
  ) {
    console.log('Hello DocumentViewerProvider Provider');

    this.platform.ready().then(() => {
      this.fileTransfer = this.transfer.create();
    })
  }

  viewDisclosure(navCtrl: NavController, item: Disclosure) {
    if(this.platform.is('cordova')) {
      this.firebase.logEvent('select_content', {
        content_type: 'disclosure_pdf', 
        item_id: item.document,
        code: item.code,
      }).then(() => console.log('document viewed'))

      const loading = this.loadingCtrl.create({
        content: 'ファイルをダウンロード中',
        enableBackdropDismiss: true,
        dismissOnPageChange: true,
      })
      loading.present();
      const obs = Observable.fromPromise(this.app.storage().ref().child(`/disclosures/${item.document}.pdf`).getDownloadURL())
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
      loading.onDidDismiss(() => {
        obs.unsubscribe();
      })
    } else {
      navCtrl.push('DocumentViewPage', item);
    }
  }
}
