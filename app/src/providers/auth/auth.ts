import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFireAuth } from "angularfire2/auth";
import { Observable } from 'rxjs';

/*
  Generated class for the AuthProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class AuthProvider {

  uid$: Observable<string>

  constructor(afAuth: AngularFireAuth) {
    // afAuth.auth.signInAnonymously().then(e => console.log(e));
    this.uid$ = afAuth.authState.filter(e => !!e)
    .map(u => u.uid)
    .shareReplay(1);
  }

}
