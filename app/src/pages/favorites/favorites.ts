import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { FavoriteProvider } from '../../providers/favorite/favorite';
import { CompanyProvider } from '../../providers/company/company';
import { Observable } from 'rxjs';
import { DocumentListPage } from '../document-list/document-list';

/**
 * Generated class for the FavoritesPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-favorites',
  templateUrl: 'favorites.html',
})
export class FavoritesPage {

  favorites;
  loading: Observable<boolean>;
  readonly documentListPage = DocumentListPage;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private fp: FavoriteProvider,
    private cp: CompanyProvider,
  ) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad FavoritesPage');
    this.favorites = Observable.combineLatest(
      this.fp.favorite$,
      this.cp.companies$.startWith([]),
    ).map(([favorites, companies]) => {
      console.log(companies.length)
      return favorites.map(code => {
        return {
          id: code,
          data: companies.find(f => f.id === code)
        }
      })
    })
    this.loading = this.favorites.map(() => false).startWith(true);
  }

  delete(item) {
    console.log(`deleting ${item}`);
    this.fp.delete(item);
  }

}
