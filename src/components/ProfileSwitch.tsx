import { SELLER_PROFILES } from '../fixtures/account';
import { useStore } from '../state/store';
import type { SellerProfileId } from '../types';
import { useFeedback } from './ui/feedback';
import { Segmented } from './ui/primitives';

/** Switches the seller context. Guidance, questions and success criteria all follow it. */
export function ProfileSwitch() {
  const { state, dispatch } = useStore();
  const { announce } = useFeedback();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span className="eyebrow">Preparing as</span>
      <Segmented<SellerProfileId>
        label="Seller profile"
        testId="profile-switch"
        value={state.sellerProfileId}
        options={Object.values(SELLER_PROFILES).map((p) => ({ value: p.id, label: p.role, hint: p.tenureLabel }))}
        onChange={(profileId) => {
          if (profileId === state.sellerProfileId) return;
          dispatch({ type: 'profile/set', profileId });
          announce(`Guidance updated for ${SELLER_PROFILES[profileId].role}, ${SELLER_PROFILES[profileId].tenureLabel}.`);
        }}
      />
    </div>
  );
}
