import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
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

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    public sanitizer: DomSanitizer,
    private app: FirebaseApp
  ) {
    this.document = this.navParams.data;
    // this.documentUrl = sanitizer.bypassSecurityTrustResourceUrl(`https://docs.google.com/viewer?url=https://www.release.tdnet.info/inbs/${this.document.document}.pdf&embedded=true`)
    this.documentUrl = Observable.fromPromise(this.app.storage().ref().child(`/disclosures/${this.document.document}.pdf`).getDownloadURL())
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

}
