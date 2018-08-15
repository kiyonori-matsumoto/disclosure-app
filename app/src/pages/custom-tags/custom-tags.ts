import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { CustomTagsProvider } from '../../providers/custom-tags/custom-tags';
import { Observable } from 'rxjs';

/**
 * Generated class for the FavoritesPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-favorites',
  templateUrl: 'custom-tags.html',
})
export class CustomTagsPage {

  tags;
  loading: Observable<boolean>;
  item: string;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private ctp: CustomTagsProvider,
  ) { }

  ionViewDidLoad() {
    console.log('ionViewDidLoad FavoritesPage');
    this.tags = this.ctp.tag$;
    this.loading = this.tags.map(() => false).startWith(true);
  }

  delete(item) {
    console.log(`deleting ${item}`);
    this.ctp.delete(item);
  }

  add() {
    if (this.item) {
      this.ctp.add(this.item);
      this.item = "";
    }
  }

}
