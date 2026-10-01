import type { BaseQueryApi } from '@reduxjs/toolkit/query';
import { recordListWindow } from '../recordListWindow';
import { listWindowReducer, listWindowServed } from '@/store/slices/listWindowSlice';

const run = async (body: unknown, type: 'query' | 'mutation' = 'query') => {
  const dispatch = jest.fn();
  const api = { dispatch, endpoint: 'getSales', type } as unknown as BaseQueryApi;
  const result = await recordListWindow(async () => ({ data: body }))('/sales', api, {});
  return { dispatch, result };
};

describe('recordListWindow', () => {
  it('records the window a windowed endpoint served', async () => {
    const { dispatch } = await run({
      data: [1, 2],
      meta: { total: 1240, page: 0, size: 500, truncated: true },
    });

    expect(dispatch).toHaveBeenCalledWith(
      listWindowServed({ endpoint: 'getSales', truncated: true, total: 1240, size: 500 }),
    );
  });

  it('passes the response through untouched', async () => {
    const body = { data: [1, 2], meta: { total: 2, page: 0, size: 500, truncated: false } };
    const { result } = await run(body);

    expect(result.data).toBe(body);
  });

  it('ignores a response without window meta', async () => {
    expect((await run({ data: [1, 2] })).dispatch).not.toHaveBeenCalled();
    expect((await run({ data: [], meta: { page: 0 } })).dispatch).not.toHaveBeenCalled();
    expect((await run(undefined)).dispatch).not.toHaveBeenCalled();
  });

  it('ignores mutations', async () => {
    const { dispatch } = await run(
      { data: [], meta: { total: 9, page: 0, size: 5, truncated: true } },
      'mutation',
    );

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('clears the notice once the list fits again', () => {
    const truncated = listWindowReducer(
      {},
      listWindowServed({ endpoint: 'getSales', truncated: true, total: 1240, size: 500 }),
    );
    expect(truncated.getSales).toEqual({ total: 1240, size: 500 });

    const whole = listWindowReducer(
      truncated,
      listWindowServed({ endpoint: 'getSales', truncated: false, total: 12, size: 500 }),
    );
    expect(whole.getSales).toBeUndefined();
  });
});
