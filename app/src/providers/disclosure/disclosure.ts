import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';
import { AngularFireDatabase, FirebaseListObservable } from "angularfire2/database";
import { Observable } from "rxjs";

/*
  Generated class for the DisclosureProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class DisclosureProvider {

  constructor(private afDB: AngularFireDatabase) {
  }

  public all() {
    return Observable.of([{
      code: '62640',
      company: 'M-マルマエ',
      title: '平成29年８月度 月次受注残高についてのお知らせ',
      document: '140120170909470727',
      exchanges: ['東'],
      time: 1504936800000,
    }, {
      code: '27760',
      company: 'J-クリムゾン',
      title: '営業外収益(為替差益)の発生及び平成30年１月期第２四半期業績予想(単体)の修正並びに連結決算開始に伴う連結業績予想公表に関するお知らせ',
      document: '140120170908470508',
      exchanges: ['東'],
      time: 1504867800000,
    }]) as Observable<any[]>
  }

}
