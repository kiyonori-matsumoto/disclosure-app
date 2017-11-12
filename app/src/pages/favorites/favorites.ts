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
    this.favorites = this.fp.favorite$
    .map(s =>
      s.map(e => {
        return {
          id: e,
          data: this.cp.byCode(e)
        }
      })
    );
    this.loading = this.fp.favorite$.map(() => false).startWith(true);
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad FavoritesPage');
  }

  delete(item) {
    console.log(`deleting ${item}`);
    this.fp.delete(item);
  }

}
