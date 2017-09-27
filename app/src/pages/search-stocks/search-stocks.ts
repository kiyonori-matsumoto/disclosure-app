import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import * as _ from 'lodash';
import { DocumentListPage } from '../document-list/document-list';

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
  items: string[] = [];

  constructor(public navCtrl: NavController, public navParams: NavParams) {
    this.companies = _.range(1000, 10000).map(e => e.toString());
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad SearchStocksPage');
  }

  changeInput() {
    console.log("changeInput", this.companies[0]);
    this.items = (this.input.length < 2) ? [] : 
      this.companies.filter(e => e.includes(this.input))
  }

}
