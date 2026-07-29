import asyncio
import sys
import os
import uuid

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.session import AsyncSessionLocal
from database.models.general import User, Business, Property, UserInvitation, LoginAuditLog
from services.auth_service import (
    authenticate_user,
    register_business,
    create_access_token,
    decode_access_token,
    get_user_permissions,
    create_employee_invitation,
    accept_employee_invitation
)
from sqlalchemy import select

async def test_auth_rbac_logic():
    print("--- Starting Enterprise IAM & RBAC Integration Tests ---")
    
    email = f"owner_{uuid.uuid4().hex[:6]}@test.com"
    pwd = "password123"
    biz_name = "RBAC Test Corp"
    
    # 1. Register Owner and Business
    print("\n[1] Testing Business Registration & Owner Setup...")
    async with AsyncSessionLocal() as session:
        reg_result = await register_business(session, email, pwd, biz_name)
        print(f"Registered Business ID: {reg_result['business_id']}")
        print(f"Registered Owner ID: {reg_result['user_id']}")
        
        # Verify user
        stmt = select(User).where(User.id == reg_result['user_id'])
        res = await session.execute(stmt)
        user = res.scalar_one()
        assert user.role == "owner"
        assert user.status == "active"
        business_id = reg_result['business_id']
    
    # 2. Authenticate User (login) & check token creation
    print("\n[2] Testing User Authentication & Token Generation...")
    async with AsyncSessionLocal() as session:
        auth_user = await authenticate_user(session, email, pwd)
        assert auth_user is not None
        print(f"Auth Success for: {auth_user.email}")
        
        # Check permissions logic (Owner should have * or default owner list)
        permissions = await get_user_permissions(auth_user, session)
        print(f"Owner Permissions: {permissions}")
        assert len(permissions) > 0
        
        # Generate token
        token = create_access_token({
            "user_id": auth_user.id,
            "business_id": auth_user.business_id,
            "email": auth_user.email,
            "role": auth_user.role,
            "department": auth_user.department or "general",
            "permissions": permissions
        })
        print(f"Generated JWT: {token[:30]}...")
        
        # Decode token
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["user_id"] == auth_user.id
        print("JWT cryptographically validated.")

    # 3. Create Staff Invitation
    print("\n[3] Testing Employee Invitations...")
    invite_email = f"reception_{uuid.uuid4().hex[:6]}@test.com"
    async with AsyncSessionLocal() as session:
        # Create property
        prop = Property(id=str(uuid.uuid4()), business_id=business_id, name="Main Hotel Lodge")
        session.add(prop)
        await session.commit()
        print(f"Created Test Property: {prop.name} (ID: {prop.id})")
        
        invite = await create_employee_invitation(
            session=session,
            business_id=business_id,
            email=invite_email,
            role_code="receptionist",
            department="reception",
            property_id=prop.id
        )
        print(f"Created Invitation for: {invite.email} (ID/Token: {invite.id})")
        assert invite.status == "pending"
        assert invite.role == "receptionist"
        
        # 4. Accept Invitation
        print("\n[4] Testing Invitation Acceptance...")
        employee = await accept_employee_invitation(session, invite.id, "securepwd999")
        print(f"Employee Created: {employee.email} (Role: {employee.role}, Dept: {employee.department}, Prop: {employee.property_id})")
        assert employee.role == "receptionist"
        assert employee.department == "reception"
        assert employee.property_id == prop.id
        assert employee.status == "active"
        
        # Check employee permissions
        emp_perms = await get_user_permissions(employee, session)
        print(f"Receptionist Permissions: {emp_perms}")
        assert "hotel.reservations.read" in emp_perms
        assert "hotel.reservations.create" in emp_perms
        # Should NOT have admin privileges
        assert "module.install" not in emp_perms

        # 5. Test Suspension
        print("\n[5] Testing Account Suspension...")
        employee.status = "suspended"
        session.add(employee)
        await session.commit()
        
        # Try to authenticate suspended user (should raise ValueError)
        try:
            await authenticate_user(session, employee.email, "securepwd999")
            print("FAILURE: Suspended user was able to log in!")
            assert False
        except ValueError as e:
            print(f"SUCCESS: Suspended user block verified: {e}")
            assert "suspended" in str(e).lower()

    print("\n--- All IAM & RBAC Tests Passed Successfully ---")

if __name__ == "__main__":
    asyncio.run(test_auth_rbac_logic())
