import { Pipe, PipeTransform } from '@angular/core';
import * as moment from 'moment';

/**
 * Generated class for the TwitterTimePipe pipe.
 *
 * See https://angular.io/api/core/Pipe for more info on Angular Pipes.
 */
@Pipe({
  name: 'twitterTime',
})
export class TwitterTimePipe implements PipeTransform {
  /**
   * Takes a value and makes it lowercase.
   */
  transform(value: string, ...args) {
    const t1 = moment(value).locale('ja');
    // const now = moment();
    // const diff = moment.duration(now.diff(t1));
    // return diff.humanize(true);
    return t1.subtract(9, 'hours').fromNow()
  }
}
