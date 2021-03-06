import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams, AlertController, Platform } from 'ionic-angular';
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { FirebaseApp } from 'angularfire2';
import 'firebase/storage';
import { Observable } from "rxjs";
/**
 * Generated class for the DocumentViewPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-document-view',
  templateUrl: 'document-view.html',
})
export class DocumentViewPage implements OnInit {
  ngOnInit(): void {
  }

  document;
  documentUrl;
  pages: number[] = [];
  error: any;
  zoom = 1.0;
  isCordova: boolean;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    public sanitizer: DomSanitizer,
    private app: FirebaseApp,
    private alertCtrl: AlertController,
    private platform: Platform,
  ) {
    this.isCordova = platform.is('cordova');
    
    this.document = this.navParams.data;
    this.documentUrl = Observable.fromPromise(this.app.storage().ref().child(`/disclosures/${this.document.document}.pdf`).getDownloadURL())
    .startWith('')
    .map(this.sanitizer.bypassSecurityTrustResourceUrl)
    .catch(err => {
      let alert = this.alertCtrl.create({
        title: 'Error',
        subTitle: err.message,
        buttons: ['Dismiss'],
      });
      alert.onDidDismiss(() => navCtrl.pop());
      alert.present();
      throw err;
    });
    
    // this.documentUrl = sanitizer.bypassSecurityTrustResourceUrl(`https://docs.google.com/viewer?url=https://www.release.tdnet.info/inbs/${this.document.document}.pdf&embedded=true`)
    // .map(this.sanitizer.bypassSecurityTrustResourceUrl)
    // .map(d => this.sanitizer.bypassSecurityTrustResourceUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(d)}&embedded=true`))
    // .startWith(this.sanitizer.bypassSecurityTrustResourceUrl(''))

  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentViewPage');
  }

  onPdfLoadComplete(pdf: PDFDocumentProxy) {
    this.pages = Array.from(Array(pdf.numPages).keys());
    console.log(this.pages);
  }

  onPdfDblClick() {
    console.log("dclick");
    this.zoom = (this.zoom === 1.0) ? 0.5 : 1.0;
  }
}
