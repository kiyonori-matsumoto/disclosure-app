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
    return this.afDB.list('/disclosures', {query: {orderByChild: 'time', limitToLast: 20}}) as Observable<any>;
  }

}
