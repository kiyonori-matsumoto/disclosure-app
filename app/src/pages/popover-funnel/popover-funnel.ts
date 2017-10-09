import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { Subject } from 'rxjs';

/**
 * Generated class for the PopoverFunnelPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-popover-funnel',
  templateUrl: 'popover-funnel.html',
})
export class PopoverFunnelPage implements OnInit {

  tags: string[];
  tagCtrl: any;
  change$: Subject<any>;

  ngOnInit(): void {
    if (this.navParams.data) {
      this.tags = this.navParams.data.tags;
      this.tagCtrl = this.navParams.data.tagCtrl;
      this.change$ = this.navParams.data.change$;
    }
  }

  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad PopoverFunnelPage');
  }

  onChange() {
    setTimeout(() => this.change$.next(Object.assign({}, this.tagCtrl)), 100);
  }

}
