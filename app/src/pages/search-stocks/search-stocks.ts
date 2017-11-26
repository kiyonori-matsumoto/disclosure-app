import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import * as _ from 'lodash';
import { DocumentListPage } from '../document-list/document-list';
import { CompanyProvider } from '../../providers/company/company';
import { Observable, Subject } from 'rxjs';

/**
 * Generated class for the SearchStocksPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-search-stocks',
  templateUrl: 'search-stocks.html',
})
export class SearchStocksPage {

  readonly documentListPage = DocumentListPage;

  input = "";
  companies: string[];
  itemsAsync: Observable<any>;
  input$ = new Subject<any>();

  constructor(public navCtrl: NavController, public navParams: NavParams, private cp: CompanyProvider) {
    this.itemsAsync = Observable.combineLatest(
      this.cp.all(),
      this.input$.asObservable(),
    ).map(([companies, filter]) => {
      console.log(`companies length = ${companies.length}, companies[0] = ${JSON.stringify(companies[0])}`)
      if (filter.length < 2) return [];
      return companies.filter(c => c.id.includes(filter))
        .map(e => { return {
          id: e.id,
          data: e,
        }; })
    })
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad SearchStocksPage');
  }

  changeInput() {
    this.input$.next(`${this.input}`);
    // console.log("changeInput", this.companies[0]);
    // this.items = (this.input.length < 2) ? [] : 
    //   this.companies.filter(e => e.includes(this.input))
  }

}
