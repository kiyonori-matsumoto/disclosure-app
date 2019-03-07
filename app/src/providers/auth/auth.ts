import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import "rxjs/add/operator/map";
import { AngularFireAuth } from "angularfire2/auth";
import { Observable } from "rxjs";
import { GooglePlus } from "@ionic-native/google-plus";
import * as firebase from "firebase";
import { Platform } from "ionic-angular/platform/platform";
import { Storage } from "@ionic/storage";

/*
  Generated class for the AuthProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class AuthProvider {
  uid$: Observable<string>;
  loginProvider$: Observable<any>;

  private readonly HAS_LOGGED_IN = "has_logged_in";

  private readonly GOOGLE_OPTIONS = {
    webClientId:
      "1069938845824-sp6urskq03e06h52lm0sgrq77t0nln28.apps.googleusercontent.com",
    offline: true
  };

  constructor(
    private afAuth: AngularFireAuth,
    private googlePlus: GooglePlus,
    private platform: Platform,
    private storage: Storage
  ) {
    this.afAuth.auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .then(console.log);

    this.platform.ready().then(() => {
      // if (!afAuth.auth.currentUser) {
        // if (this.storage.get(this.HAS_LOGGED_IN)) {
      afAuth.authState.subscribe(user => {
        if (!user) {
          const cordova_login = () => {
            if (this.platform.is("cordova")) {
              return this.googlePlus.trySilentLogin(this.GOOGLE_OPTIONS);
            }
            return Promise.reject("not cordova");
          };
          // this.googlePlus.trySilentLogin(this.GOOGLE_OPTIONS)
          cordova_login()
            .then(
              res => {
                console.log("do google login");
                const idToken = res.idToken;
                const displayName = res.displayName;
                const credential = firebase.auth.GoogleAuthProvider.credential(
                  idToken
                );
                return this.afAuth.auth.signInWithCredential(credential);
              },
              err => {
                console.warn(err, JSON.stringify(err));
                console.log("do anonymous login");
                return afAuth.auth.signInAnonymously();
              }
            )
            .then(() => console.log("successfully logged in"))
            .catch(err =>
              console.error(`login failed: ${err.message || err.code || err}`)
            );
        }
      })
    });

    this.uid$ = afAuth.authState
      .filter(e => !!e)
      .map(u => u.uid)
      .publishReplay(1)
      .refCount();

    this.loginProvider$ = afAuth.authState
      .map(user => {
        if (!user) return {};
        return user.providerData.reduce((a, e) => {
          a[e.providerId.replace(".", "_")] = true;
          return a;
        }, {});
      })
      .do(
        e => console.log(`loginProvider$ ${JSON.stringify(e)}`),
        e => console.error(`loginProvider$ ${JSON.stringify(e)}`)
      );
  }

  public linkToGoogle() {
    return this.googlePlus.login(this.GOOGLE_OPTIONS).then(res => {
      console.log(JSON.stringify(res));
      const idToken = res.idToken;
      const displayName = res.displayName;
      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      const user = this.afAuth.auth.currentUser;
      return user
        .linkWithCredential(credential)
        .catch((err: firebase.auth.Error) => {
          if (
            err.code === "auth/credential-already-in-use" ||
            err.code === "auth/email-already-in-use"
          ) {
            console.log(
              "recovering by errorcode == auth/credential-already-in-use"
            );
            return this.afAuth.auth.signInWithCredential(credential);
          }
          console.error(`linkWithCredential Failed: ${JSON.stringify(err)}`);
          return Promise.reject(err);
        })
        .then(() => {
          const user = this.afAuth.auth.currentUser;
          user.reload();
          return user.updateProfile({
            displayName: res.displayName,
            photoURL: res.photoURL
          });
        });
    });
  }

  public unlinkFromGoogle() {
    return this.afAuth.auth.currentUser.unlink("google.com").then(() => {
      this.afAuth.auth.currentUser.reload();
      return this.googlePlus.disconnect();
    });
  }
}
