import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { SearchStocksPage } from './search-stocks';

@NgModule({
  declarations: [
    SearchStocksPage,
  ],
  imports: [
    IonicPageModule.forChild(SearchStocksPage),
  ],
})
export class SearchStocksPageModule {}
